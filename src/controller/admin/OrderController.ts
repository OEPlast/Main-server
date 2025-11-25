import { Request, Response } from 'express';
import OrderService from '../../services/admin/Order';

// Get all orders
const getOrders = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      orderId,
      customerId,
      startDate,
      endDate,
      transactionStatus,
      search,
    } = req.query;

    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (orderId) filters.orderId = orderId;
    if (customerId) filters.customerId = customerId;
    if (search) filters.search = search;
    if (transactionStatus) filters.transactionStatus = transactionStatus;
    if (startDate && endDate)
      filters.dateRange = { start: new Date(startDate as string), end: new Date(endDate as string) };

    const { data, message, code, meta } = await OrderService.getOrders(Number(page), Number(limit), filters);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getOrders:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order by ID
const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, message, code } = await OrderService.getOrderById(id);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Cancel an order
const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { message, code } = await OrderService.cancelOrder(orderId);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update delivery timeline
const updateDeliveryTimeline = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { timeline } = req.body;
    const { message, code, data } = await OrderService.updateDeliveryTimeline(orderId, timeline);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateDeliveryTimeline:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject an order
const rejectOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { message, code } = await OrderService.rejectOrder(orderId);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in rejectOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update order details
const updateOrderDetails = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const updates = req.body;
    const { message, code, data } = await OrderService.updateOrderDetails(orderId, updates);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateOrderDetails:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all returned orders
const getAllReturns = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { data, message, code } = await OrderService.getAllReturns({
      page: ~~page,
      limit: ~~limit,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAllReturns:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Fetch the 15 most ordered products within a time frame
const getTopOrderedProducts = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const { data, message, code } = await OrderService.getTopOrderedProducts(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTopOrderedProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const Admin_OrderController = {
  getOrders,
  getOrderById,
  cancelOrder,
  updateDeliveryTimeline,
  rejectOrder,
  updateOrderDetails,
  getAllReturns,
  getTopOrderedProducts,
};

export default Admin_OrderController;
