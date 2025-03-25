import { Request, Response } from 'express';
import OrderService from '../../services/admin/Order';

// Get all orders
const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { data, message, code } = await OrderService.getAllOrders();
    res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAllOrders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order by ID
const getOrderById = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { data, message, code } = await OrderService.getOrderById(orderId);
    res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderById:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update order status
const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const { message, code } = await OrderService.updateOrderStatus(orderId, status);
    res.status(code).json({ message });
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Cancel an order
const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { message, code } = await OrderService.cancelOrder(orderId);
    res.status(code).json({ message });
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update delivery timeline
const updateDeliveryTimeline = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { timeline } = req.body;
    const { message, code } = await OrderService.updateDeliveryTimeline(orderId, timeline);
    res.status(code).json({ message });
  } catch (error) {
    console.error('Error in updateDeliveryTimeline:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Confirm an order
const confirmOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { message, code } = await OrderService.confirmOrder(orderId);
    res.status(code).json({ message });
  } catch (error) {
    console.error('Error in confirmOrder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject an order
const rejectOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { message, code } = await OrderService.rejectOrder(orderId);
    res.status(code).json({ message });
  } catch (error) {
    console.error('Error in rejectOrder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  updateDeliveryTimeline,
  confirmOrder,
  rejectOrder,
};
