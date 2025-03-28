import { Request, Response } from 'express';
import OrderService from '../services/orderService';
import { OrderType } from '@/models/Order';

// Fetch paginated order history for a user
export const getOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { page = 1, limit = 10, status, deliveryStatus } = req.query;

    const filters = { userId, status, deliveryStatus } as unknown as {
      userId: string;
      status?: OrderType['status'];
      deliveryStatus?: OrderType['deliveryStatus'];
    };

    const { data, message, code } = await OrderService.getOrderHistory(~~page, ~~limit, filters);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrders:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Place a new order with stock validation
export const placeOrder = async (req: Request, res: Response) => {
  try {
    const {
      user,
      products,
      shippingAddress,
      paymentMethod,
      paymentResult,
      total,
      totalBeforeDiscount,
      couponApplied,
      shippingPrice,
      taxPrice,
      isPaid,
      status,
      deliveryStatus,
      shippingProgress,
    } = req.body;
    const { data, message, code } = await OrderService.placeOrderWithStockValidation({
      user,
      products,
      shippingAddress,
      paymentMethod,
      paymentResult,
      total,
      totalBeforeDiscount,
      couponApplied,
      shippingPrice,
      taxPrice,
      isPaid,
      status,
      deliveryStatus,
      shippingProgress,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in placeOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const { data, message, code } = await OrderService.getOneOrder({ orderId: id, userId });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update an order
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { address } = req.body;

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
    const userId = req.userId!;

    const { message, code } = await OrderService.cancelOrder(id, userId);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in deleteOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const OrderController = { getOrders, getOrderById, placeOrder, updateOrder, cancelOrder };
export default OrderController;
