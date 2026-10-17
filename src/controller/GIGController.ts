import { Request, Response } from 'express';
import mongoose from 'mongoose';
import GIGService from '@/services/GIGService';
import { GIGCalculateShippingInput, GIGShippingRequest } from '@/types/gig';
import Product from '@/models/Product';
import { applyFreeDelivery, priceCart } from '@/services/pricing';

type QuoteItems = GIGShippingRequest['items'];

/**
 * Prices the cart and gives each line its GIG weight, size and declared value (the line total
 * from the shared pricing module, tiers and sales included, the same value checkout declares).
 */
async function resolveQuoteItems(
  items: QuoteItems | undefined
): Promise<{ error: string } | { items: GIGCalculateShippingInput['items']; itemsSubtotal: number }> {
  if (!items || items.length === 0) return { error: 'No items provided' };

  const validItems = items.filter((i) => mongoose.isValidObjectId(i.productId));
  const priced = await priceCart(
    validItems.map((i) => ({ product: i.productId, qty: i.quantity, selectedAttributes: i.selectedAttributes ?? [] }))
  );
  if (priced.missingProductIds.length > 0 || validItems.length !== items.length) {
    return {
      error: `Product not found: ${priced.missingProductIds[0] ?? items.find((i) => !mongoose.isValidObjectId(i.productId))?.productId}`,
    };
  }

  const products = await Product.find({ _id: { $in: validItems.map((i) => i.productId) } })
    .select('name weight height width length isVolumetric')
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  return {
    itemsSubtotal: priced.itemsSubtotal,
    items: priced.lines.map((line) => {
      const product = productMap.get(line.productId);
      return {
        name: product?.name ?? line.name,
        quantity: line.qty,
        weight: product?.weight ?? 0.01,
        height: product?.height ?? 1,
        width: product?.width ?? 1,
        length: product?.length ?? 1,
        isVolumetric: product?.isVolumetric ?? false,
        value: line.lineTotal,
      };
    }),
  };
}

/** Quotes GIG and answers with the price after free delivery over the threshold. */
async function respondWithQuote(res: Response, input: GIGCalculateShippingInput, itemsSubtotal: number) {
  const result = await GIGService.calculateShipping(input);
  if (!result.data) {
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  }
  // Free delivery over the threshold applies to GIG too; checkout applies the same rule.
  const { freeShippingThreshold } = (await GIGService.getPublicCheckoutConfig()).data;
  const free = applyFreeDelivery(result.data.shippingCost, itemsSubtotal, freeShippingThreshold);
  return res.status(result.code).json({
    message: result.message,
    data: { ...result.data, shippingCost: free.amount, freeShippingApplied: free.freeDeliveryApplied, freeShippingThreshold },
    code: result.code,
  });
}

/**
 * GET /gig/service-centres?state=Lagos
 * GIG service centres in a state, where pickup orders can be collected.
 */
const getServiceCentres = async (req: Request, res: Response) => {
  try {
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    if (!state) return res.status(400).json({ message: 'state is required', data: null, code: 400 });
    if (!(await GIGService.isDeliveryMethodEnabled('gig'))) {
      return res.status(200).json({ message: 'GIG pickup is unavailable', data: [], code: 200 });
    }
    const result = await GIGService.getServiceCentresForState(state);
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error fetching GIG service centres:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * POST /gig/centre-quote { items, state, serviceCentreId }
 * GIG price for collecting the cart at a service centre. Open to guests (rate limited).
 */
const centreQuote = async (req: Request, res: Response) => {
  try {
    const body = req.body as { items?: QuoteItems; state?: string; serviceCentreId?: number };
    const state = typeof body.state === 'string' ? body.state.trim() : '';
    const centreId = Number(body.serviceCentreId);
    if (!state || !Number.isInteger(centreId)) {
      return res.status(400).json({ message: 'state and serviceCentreId are required', data: null, code: 400 });
    }

    const resolved = await resolveQuoteItems(body.items);
    if ('error' in resolved) return res.status(400).json({ message: resolved.error, data: null, code: 400 });

    const centre = await GIGService.findServiceCentre(state, centreId);
    if (!centre) {
      return res.status(400).json({ message: 'That GIG pickup centre is no longer available', data: null, code: 400 });
    }

    return respondWithQuote(
      res,
      {
        items: resolved.items,
        receiverAddress: centre.address,
        receiverState: state,
        receiverName: '',
        receiverPhoneNumber: '',
        receiverCountryCode: 'NG',
        serviceCentre: centre,
      },
      resolved.itemsSubtotal
    );
  } catch (error) {
    console.error('Error quoting GIG centre pickup:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * POST /gig/calculate-shipping
 * Client sends { items: [{ productId, quantity, selectedAttributes? }], receiverAddress, ... }
 * Backend resolves product dimensions + pricing then calls GIG price API.
 */
const calculateShipping = async (req: Request, res: Response) => {
  try {
    const body = req.body as GIGShippingRequest;
    const resolved = await resolveQuoteItems(body.items);
    if ('error' in resolved) return res.status(400).json({ message: resolved.error, data: null, code: 400 });

    return respondWithQuote(
      res,
      {
        items: resolved.items,
        receiverAddress: body.receiverAddress,
        receiverState: body.receiverState,
        receiverCity: body.receiverCity,
        receiverLatitude: body.receiverLatitude,
        receiverLongitude: body.receiverLongitude,
        receiverName: body.receiverName,
        receiverPhoneNumber: body.receiverPhoneNumber,
        receiverCountryCode: 'NG',
      },
      resolved.itemsSubtotal
    );
  } catch (error) {
    console.error('Error calculating GIG shipping:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * GET /gig/stations
 * Get GIG stations list (for display if needed)
 */
const getStations = async (_req: Request, res: Response) => {
  try {
    const result = await GIGService.getStations();
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error fetching GIG stations:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * GET /gig/track/:waybill
 * Track a GIG shipment by waybill number
 */
const trackShipment = async (req: Request, res: Response) => {
  try {
    const { waybill } = req.params;
    if (!waybill) {
      return res.status(400).json({ message: 'Waybill number is required', data: null, code: 400 });
    }
    const result = await GIGService.trackShipment(waybill);
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error tracking GIG shipment:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * GET /gig/config
 * Public checkout delivery settings used by storefront.
 */
const getCheckoutConfig = async (_req: Request, res: Response) => {
  try {
    const result = await GIGService.getPublicCheckoutConfig();
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error fetching public GIG checkout config:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const GIGController = {
  calculateShipping,
  getServiceCentres,
  centreQuote,
  getStations,
  trackShipment,
  getCheckoutConfig,
};

export default GIGController;
