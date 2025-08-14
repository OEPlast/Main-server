import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import OrderService from '../services/orderService';
import { OrderType } from '@/models/Order';
import PaymentService from '@/services/PaymentService';
import User from '@/models/User';

// Fetch paginated order history for a user
export const getOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
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
      flashSaleApplied,
      couponDiscount,
    } = req.body as Partial<OrderType> & { user: string };

    const payloadBase = {
      user,
      products: products!,
      shippingAddress,
      paymentMethod,
      paymentResult,
      total: total!,
      totalBeforeDiscount,
      couponApplied,
      couponDiscount: couponDiscount ?? 0,
      shippingPrice: shippingPrice!,
      taxPrice: taxPrice ?? 0,
      isPaid: isPaid ?? false,
      status: (status ?? 'Pending') as OrderType['status'],
      deliveryStatus: (deliveryStatus ?? 'In-Warehouse') as OrderType['deliveryStatus'],
    };

    const payload = {
      ...payloadBase,
      ...(shippingProgress ? { shippingProgress: shippingProgress as OrderType['shippingProgress'] } : {}),
      ...(flashSaleApplied ? { flashSaleApplied: flashSaleApplied as OrderType['flashSaleApplied'] } : {}),
    };

    const { data, message, code } = await OrderService.placeOrderWithStockValidation(
      payload as Parameters<typeof OrderService.placeOrderWithStockValidation>[0]
    );
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
    const userId = (req as AuthenticatedRequest).userId!;

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

// Checkout and initialize payment
export const checkoutAndInitPayment = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;

    type CreateOrderBody = Pick<
      OrderType,
      | 'products'
      | 'shippingAddress'
      | 'paymentMethod'
      | 'paymentResult'
      | 'total'
      | 'totalBeforeDiscount'
      | 'couponApplied'
      | 'shippingPrice'
      | 'taxPrice'
      | 'isPaid'
      | 'status'
      | 'deliveryStatus'
      | 'shippingProgress'
      | 'flashSaleApplied'
    >;

    const body = req.body as Partial<CreateOrderBody>;

    const base: Omit<CreateOrderBody, 'shippingProgress' | 'flashSaleApplied'> = {
      products: body.products!,
      shippingAddress: body.shippingAddress,
      paymentMethod: body.paymentMethod,
      paymentResult: body.paymentResult,
      total: body.total!,
      totalBeforeDiscount: body.totalBeforeDiscount,
      couponApplied: body.couponApplied,
      shippingPrice: body.shippingPrice!,
      taxPrice: body.taxPrice ?? 0,
      isPaid: body.isPaid ?? false,
      status: (body.status ?? 'Pending') as OrderType['status'],
      deliveryStatus: (body.deliveryStatus ?? 'In-Warehouse') as OrderType['deliveryStatus'],
    };

    const orderInput = {
      ...base,
      ...(body.shippingProgress ? { shippingProgress: body.shippingProgress as OrderType['shippingProgress'] } : {}),
      ...(body.flashSaleApplied ? { flashSaleApplied: body.flashSaleApplied as OrderType['flashSaleApplied'] } : {}),
      user: userId,
    } as Parameters<typeof OrderService.placeOrderWithStockValidation>[0];

    const placed = await OrderService.placeOrderWithStockValidation(orderInput);
    if (!placed.data) return res.status(placed.code).json({ message: placed.message, data: null });

    const order = placed.data;

    // Get user's email for Paystack
    const userDoc = await User.findById(userId).select('email');
    const email = userDoc?.email;
    if (!email) {
      return res.status(400).json({ message: 'User email not found for payment initialization' });
    }

    const orderId = (order as unknown as { _id: { toString(): string } })._id.toString();

    const init = await PaymentService.initializePayment({
      orderId,
      userId,
      email,
      amount: order.total,
      currency: 'NGN',
      metadata: { source: 'checkout', route: 'checkout/paystack' },
    });

    return res.status(init.code).json({ message: init.message, data: { orderId, ...(init.data ?? {}) } });
  } catch (error) {
    console.error('Error in checkoutAndInitPayment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const OrderController = {
  getOrders,
  getOrderById,
  placeOrder,
  updateOrder,
  cancelOrder,
  initiateReturn,
  getAllReturns,
  checkoutAndInitPayment,
};
export default OrderController;
