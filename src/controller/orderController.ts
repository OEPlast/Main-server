import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import OrderService from '../services/orderService';
import { OrderType } from '@/models/Order';
// import { CartType } from '@/models/Cart';
import LogisticsService from '@/services/LogisticsService';
// import CartService from '@/services/cartService';
// import Cart from '@/models/Cart';
import { populateOrderWithDeliveryStatus } from '@/helpers/orderPopulation';
import CheckoutService, { SecureCheckoutPayload } from '@/services/CheckoutService';

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
      transactionStatus?: import('../models/Transaction').TransactionStatus | 'all';
    };

    const { data, message, code } = await OrderService.getOrderHistory(~~page, ~~limit, filters);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrders:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;

    const { data, message, code } = await OrderService.getOneOrder({ orderId: id, userId });

    if (data) {
      // Populate the order with delivery status from shipment
      const populatedOrder = await populateOrderWithDeliveryStatus(data);
      return res.status(code).json({ message, data: populatedOrder });
    }

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
      };
      deliveryType?: 'shipping' | 'pickup';
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart items are required', code: 400 });
    }

    // If delivery type is pickup, return zero shipping cost
    if (deliveryType === 'pickup') {
      return res.status(200).json({
        message: 'Shipping cost calculated successfully - Pickup selected',
        data: {
          shippingCost: 0,
          deliveryType: 'pickup',
          destination: null,
          currency: 'NGN',
          itemsSubtotal: items.reduce((sum, item) => sum + item.totalPrice, 0),
          estimatedTotal: items.reduce((sum, item) => sum + item.totalPrice, 0),
        },
        code: 200,
      });
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
        stateName: shippingAddress.state || 'Lagos',
        cityName: shippingAddress.city, // City has priority in lookup
        lgaName: undefined, // LGA not used if city is provided
      };

      // Calculate progressive shipping cost
      const rawShippingCost = await LogisticsService.calculateProgressiveShipping(cartItems, destination);
      const shippingCost = Math.round(rawShippingCost * 100) / 100;

      return res.status(200).json({
        message: 'Shipping cost calculated successfully',
        data: {
          shippingCost,
          deliveryType: 'shipping',
          destination,
          currency: 'NGN',
          itemsSubtotal: items.reduce((sum, item) => sum + item.totalPrice, 0),
          estimatedTotal:
            Math.round((items.reduce((sum, item) => sum + item.totalPrice, 0) + shippingCost) * 100) / 100,
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
};
export default OrderController;
