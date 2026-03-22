import ShipmentService from '@/services/admin/ShipmentService';
import LogisticsService from '@/services/LogisticsService';
import GIGService from '@/services/GIGService';
import { Request, Response } from 'express';
const trackOrder = async (req: Request, res: Response) => {
  try {
    const { trackingNumber } = req.params;
    const result = await ShipmentService.trackShipment(trackingNumber);
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error tracking shipment:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const quote = async (req: Request, res: Response) => {
  try {
    const response = await LogisticsService.quote(req.body);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error generating quote:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const getConfig = async (req: Request, res: Response) => {
  try {
    const { country } = req.params;
    const response = await LogisticsService.getConfigByCountry(country);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error fetching logistics config:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const listCountries = async (_req: Request, res: Response) => {
  try {
    const response = await LogisticsService.listCountries();
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error listing logistics countries:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const listAllConfigs = async (_req: Request, res: Response) => {
  try {
    const response = await LogisticsService.listAllConfigs();
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error listing logistics configurations:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const listLocationsTree = async (_req: Request, res: Response) => {
  try {
    const response = await LogisticsService.listLocationsTree();
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error listing logistics locations tree:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const getLocationsByCountry = async (req: Request, res: Response) => {
  try {
    const { country } = req.params;

    if (!country) {
      return res.status(400).json({ message: 'Country name is required', data: null, code: 400 });
    }

    const response = await LogisticsService.getLocationsByCountry(country);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error fetching locations by country:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const flatCartShipping = async (req: Request, res: Response) => {
  try {
    const isShippingEnabled = await GIGService.isDeliveryMethodEnabled('shipping');
    if (!isShippingEnabled) {
      return res.status(400).json({ message: 'Shipping delivery is currently unavailable', data: null, code: 400 });
    }

    const { items, destination, itemsSubtotal } = req.body as {
      items: Array<{ productId: string; quantity: number }>;
      destination: { countryName: string; stateName: string; lgaName: string };
      itemsSubtotal?: number;
    };
    const rawAmount = await LogisticsService.calculateProgressiveShipping(items, destination);
    const checkoutConfig = await GIGService.getPublicCheckoutConfig();
    const discountedShipping = GIGService.applyDeliveryDiscount(
      rawAmount,
      checkoutConfig.data.shippingDiscountAmountOff
    );
    const freeShippingThreshold = checkoutConfig.data.freeShippingThreshold;
    const qualifiesForFreeShipping =
      Number.isFinite(freeShippingThreshold) &&
      freeShippingThreshold !== null &&
      Number.isFinite(itemsSubtotal) &&
      Number(itemsSubtotal) >= freeShippingThreshold;
    const finalShippingAmount = qualifiesForFreeShipping ? 0 : discountedShipping.finalAmount;

    return res.status(200).json({
      message: 'Flat cart shipping calculated',
      data: {
        amount: finalShippingAmount,
        deliveryDiscountApplied: discountedShipping.appliedDiscount,
        freeShippingThreshold,
        freeShippingApplied: qualifiesForFreeShipping,
      },
      code: 200,
    });
  } catch (error) {
    console.error('Error calculating flat cart shipping:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const LogisticsController = {
  trackOrder,
  quote,
  getConfig,
  listCountries,
  listAllConfigs,
  listLocationsTree,
  getLocationsByCountry,
  flatCartShipping,
};
export default LogisticsController;
