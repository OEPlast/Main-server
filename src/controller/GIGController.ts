import { Request, Response } from 'express';
import mongoose from 'mongoose';
import GIGService from '@/services/GIGService';
import { GIGCalculateShippingInput, GIGShippingRequest } from '@/types/gig';
import Product from '@/models/Product';
import { applyPricingTier, resolveBestVariant } from '@/helpers/pricingUtils';

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

    // Fetch all products in one query
    const productIds = body.items.map((i) => i.productId).filter((id) => mongoose.isValidObjectId(id));

    const products = await Product.find({ _id: { $in: productIds } })
      .select('name price weight height width length isVolumetric pricingTiers attributes')
      .lean();

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const resolvedItems: GIGCalculateShippingInput['items'] = [];

    for (const item of body.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return res.status(400).json({
          message: `Product not found: ${item.productId}`,
          data: null,
          code: 400,
        });
      }

      // Resolve base unit price (variant price if applicable, else product price)
      const variant = resolveBestVariant(
        product as unknown as Parameters<typeof resolveBestVariant>[0],
        item.selectedAttributes ?? []
      );
      const basePrice = typeof variant?.price === 'number' ? variant.price : product.price;

      // Apply tier pricing (variant tiers first, then product tiers)
      let unitPrice = applyPricingTier(basePrice, item.quantity, variant?.pricingTiers);
      if (unitPrice === basePrice) {
        unitPrice = applyPricingTier(
          basePrice,
          item.quantity,
          product.pricingTiers as Parameters<typeof applyPricingTier>[2]
        );
      }

      resolvedItems.push({
        name: product.name,
        quantity: item.quantity,
        weight: product.weight ?? 0.01,
        height: product.height ?? 1,
        width: product.width ?? 1,
        length: product.length ?? 1,
        isVolumetric: product.isVolumetric ?? false,
        value: unitPrice * item.quantity,
      });
    }

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
    console.log(input);

    const result = await GIGService.calculateShipping(input);
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
