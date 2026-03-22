import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import OrderService from '../services/orderService';
import { OrderType } from '@/models/Order';
// import { CartType } from '@/models/Cart';
import LogisticsService from '@/services/LogisticsService';
import GIGService from '@/services/GIGService';
// import CartService from '@/services/cartService';
// import Cart from '@/models/Cart';
import CheckoutService, { SecureCheckoutPayload } from '@/services/CheckoutService';
import { TransactionStatus } from '@/models/Transaction';

// Fetch paginated order history for a user
export const getOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const { page = 1, limit = 10, status, transactionStatus } = req.query;

    const filters = {
      userId,
      status,
      transactionStatus,
    } as unknown as {
      userId: string;
      status?: OrderType['status'];
      transactionStatus?: TransactionStatus | 'all';
    };

    const { data, message, code, meta } = await OrderService.getOrderHistory(Number(page), Number(limit), filters);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getOrders:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order statistics for dashboard
const getOrderStatistics = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const { data, message, code } = await OrderService.getOrderStatistics(userId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderStatistics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;

    const { data, message, code } = await OrderService.getOneOrder({ orderId: id, userId });

    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Secure checkout with simplified price validation
export const secureCheckout = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const checkoutPayload = req.body as SecureCheckoutPayload;

    const result = await CheckoutService.secureCheckout(userId, checkoutPayload);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in secureCheckout:', error);
    return res.status(500).json({
      message: 'Internal server error during secure checkout',
      data: null,
    });
  }
};

// Update an order
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;
    const { address } = req.body as { address?: OrderType['shippingAddress'] };

    const { message, code } = await OrderService.updateOrderDetails(id, userId, address);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in updateOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

//  Cancel an order
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;

    const { message, code } = await OrderService.cancelOrder(id, userId);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in deleteOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Initiate a return for an order
export const initiateReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;

    const { message, code } = await OrderService.initiateReturn(id, userId);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in initiateReturn:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllReturns = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { page = 1, limit = 10 } = req.query;

    const { data, message, code } = await OrderService.getAllReturns({ userId, page: ~~page, limit: ~~limit });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAllReturns:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Calculate shipping cost for checkout preview (from cart data)
export const calculateShipping = async (req: Request, res: Response) => {
  try {
    const {
      items,
      shippingAddress,
      deliveryType = 'shipping',
    } = req.body as {
      items: Array<{
        product: string;
        qty: number;
        selectedAttributes?: Array<{ name: string; value: string }>;
        unitPrice: number;
        totalPrice: number;
      }>;
      shippingAddress?: {
        country?: string;
        state?: string;
        city?: string;
        lga?: string;
      };
      deliveryType?: 'shipping' | 'pickup';
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart items are required', code: 400 });
    }

    const itemsSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const checkoutConfig = await GIGService.getPublicCheckoutConfig();
    const freeShippingThreshold = checkoutConfig.data.freeShippingThreshold;
    const qualifiesForFreeShipping =
      Number.isFinite(freeShippingThreshold) &&
      freeShippingThreshold !== null &&
      itemsSubtotal >= freeShippingThreshold;

    const isPickupEnabled = await GIGService.isDeliveryMethodEnabled('pickup');
    const isShippingEnabled = await GIGService.isDeliveryMethodEnabled('shipping');

    // If delivery type is pickup, return zero shipping cost
    if (deliveryType === 'pickup') {
      if (!isPickupEnabled) {
        return res.status(400).json({ message: 'Pickup delivery is currently unavailable', code: 400 });
      }

      return res.status(200).json({
        message: 'Shipping cost calculated successfully - Pickup selected',
        data: {
          shippingCost: 0,
          deliveryType: 'pickup',
          destination: null,
          currency: 'NGN',
          itemsSubtotal,
          estimatedTotal: itemsSubtotal,
          freeShippingThreshold,
          freeShippingApplied: false,
        },
        code: 200,
      });
    }

    if (!isShippingEnabled) {
      return res.status(400).json({ message: 'Shipping delivery is currently unavailable', code: 400 });
    }

    // For shipping delivery, validate shipping address
    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required for shipping delivery', code: 400 });
    }

    try {
      // Prepare cart items for logistics calculation
      const cartItems = items.map((item) => ({
        productId: item.product.toString(),
        quantity: item.qty,
      }));

      // Prepare destination from shipping address (city takes priority over LGA)
      const destination = {
        countryName: shippingAddress.country || 'Nigeria',
        stateName: shippingAddress.state || '',
        cityName: shippingAddress.city, // City has priority in lookup
        lgaName: shippingAddress.lga, // LGA not used if city is provided
      };

      // Calculate progressive shipping cost
      const rawShippingCost = await LogisticsService.calculateProgressiveShipping(cartItems, destination);
      const discountedShipping = GIGService.applyDeliveryDiscount(
        rawShippingCost,
        checkoutConfig.data.shippingDiscountAmountOff
      );
      const discountedShippingCost = Math.round(discountedShipping.finalAmount * 100) / 100;
      const shippingCost = qualifiesForFreeShipping ? 0 : discountedShippingCost;

      return res.status(200).json({
        message: 'Shipping cost calculated successfully',
        data: {
          shippingCost,
          deliveryDiscountApplied: discountedShipping.appliedDiscount,
          deliveryType: 'shipping',
          destination,
          currency: 'NGN',
          itemsSubtotal,
          estimatedTotal: Math.round((itemsSubtotal + shippingCost) * 100) / 100,
          freeShippingThreshold,
          freeShippingApplied: qualifiesForFreeShipping,
        },
        code: 200,
      });
    } catch (logisticsError) {
      console.error('Logistics calculation error:', logisticsError);
      return res.status(400).json({
        message: 'Unable to calculate shipping cost. Please verify your shipping address.',
        code: 400,
      });
    }
  } catch (error) {
    console.error('Error in calculateShipping:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const OrderController = {
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  initiateReturn,
  getAllReturns,
  calculateShipping,
  secureCheckout,
  getOrderStatistics,
};
export default OrderController;
