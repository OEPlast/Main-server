import { Request, Response } from 'express';
import mongoose from 'mongoose';
import GIGService from '@/services/GIGService';
import { GIGCalculateShippingInput, GIGShippingRequest } from '@/types/gig';
import Product from '@/models/Product';
import { applyFreeDelivery, priceCart } from '@/services/pricing';

/**
 * POST /gig/calculate-shipping
 * Client sends { items: [{ productId, quantity, selectedAttributes? }], receiverAddress, ... }
 * Backend resolves product dimensions + pricing then calls GIG price API.
 */
const calculateShipping = async (req: Request, res: Response) => {
  try {
    const body = req.body as GIGShippingRequest;

    if (!body.items || body.items.length === 0) {
      return res.status(400).json({ message: 'No items provided', data: null, code: 400 });
    }

    const validItems = body.items.filter((i) => mongoose.isValidObjectId(i.productId));
    const priced = await priceCart(
      validItems.map((i) => ({ product: i.productId, qty: i.quantity, selectedAttributes: i.selectedAttributes ?? [] }))
    );
    if (priced.missingProductIds.length > 0 || validItems.length !== body.items.length) {
      return res.status(400).json({
        message: `Product not found: ${priced.missingProductIds[0] ?? body.items.find((i) => !mongoose.isValidObjectId(i.productId))?.productId}`,
        data: null,
        code: 400,
      });
    }

    const products = await Product.find({ _id: { $in: validItems.map((i) => i.productId) } })
      .select('name weight height width length isVolumetric')
      .lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // Declared value per line = the line total from the shared pricing module (tiers and sales
    // included), the same value checkout declares when it re-quotes.
    const resolvedItems: GIGCalculateShippingInput['items'] = priced.lines.map((line) => {
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
    });

    const input: GIGCalculateShippingInput = {
      items: resolvedItems,
      receiverAddress: body.receiverAddress,
      receiverState: body.receiverState,
      receiverCity: body.receiverCity,
      receiverLatitude: body.receiverLatitude,
      receiverLongitude: body.receiverLongitude,
      receiverName: body.receiverName,
      receiverPhoneNumber: body.receiverPhoneNumber,
      receiverCountryCode: 'NG',
    };
    const result = await GIGService.calculateShipping(input);
    if (result.data) {
      // Free delivery over the threshold applies to GIG too; checkout applies the same rule.
      const { freeShippingThreshold } = (await GIGService.getPublicCheckoutConfig()).data;
      const free = applyFreeDelivery(result.data.shippingCost, priced.itemsSubtotal, freeShippingThreshold);
      return res.status(result.code).json({
        message: result.message,
        data: { ...result.data, shippingCost: free.amount, freeShippingApplied: free.freeDeliveryApplied, freeShippingThreshold },
        code: result.code,
      });
    }
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
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
  getStations,
  trackShipment,
  getCheckoutConfig,
};

export default GIGController;
