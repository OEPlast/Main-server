import mongoose from 'mongoose';
import Order, { OrderType } from '../models/Order';
import Product from '../models/Product';
import { CustomResponseType } from '../types';
import AnalyticsService from './MainAnalyticsService';

/**
 * Fetches paginated orders for user with optional filters.
 * @param page - Current page number.
 * @param limit - Number of orders per page.
 * @param filters - Filters for searching orders.
 */
const getOrderHistory = async (
  page: number,
  limit: number,
  filters: { userId: string; status?: OrderType['status']; deliveryStatus?: OrderType['deliveryStatus'] }
): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>> => {
  try {
    const query: Record<string, unknown> = {};

    if (filters.userId) {
      query.user = filters.userId;
    }

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.deliveryStatus) {
      query.deliveryStatus = filters.deliveryStatus;
    }

    const orders = await Order.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalOrders = await Order.countDocuments(query);

    return {
      message: 'Orders retrieved successfully',
      data: { orders, totalOrders },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching paginated orders:', error);
    return {
      message: 'Failed to fetch orders',
      data: null,
      code: 500,
    };
  }
};

/**
 * Places a new order with stock validation.
 * @param orderData - The data for the new order.
 */

type OrderDataInput = Omit<OrderType, 'createdAt' | 'updatedAt'>;

const placeOrderWithStockValidation = async (orderData: OrderDataInput): Promise<CustomResponseType<OrderType>> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { products } = orderData;

    // Fetch all products in parallel
    const productIds = products.map((item) => item.product);
    const productDocs = await Product.find({ _id: { $in: productIds } }).session(session);

    if (productDocs.length !== products.length) {
      throw new Error('One or more products were not found.');
    }

    // Check stock and prepare updates
    const bulkUpdates = products.map((item) => {
      const product = productDocs.find((p) => p._id.toString() === item.product!.toString());
      if (!product || product.stock < item.qty!) {
        throw new Error(`Product "${product?.name}" is out of stock or insufficient quantity.`);
      }

      return {
        updateOne: {
          filter: { _id: item.product, stock: { $gte: item.qty } }, // Prevents over-selling
          update: { $inc: { stock: -item.qty! } },
        },
      };
    });

    // Perform bulk stock update
    await Product.bulkWrite(bulkUpdates, { session });

    // Create the order
    const order = new Order(orderData);
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Track order analytics after successful transaction
    // This runs independently and won't affect the response time
    AnalyticsService.trackOrderPlaced(order._id.toString(), order.total).catch((err) =>
      console.error('Failed to track order analytics:', err)
    );

    return {
      message: 'Order placed successfully',
      data: order,
      code: 201,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error placing order with stock validation:', error);
    if (error instanceof Error) {
      return {
        message: error.message || 'Failed to place order',
        data: null,
        code: 400,
      };
    } else {
      return {
        message: 'Internal server error',
        data: null,
        code: 500,
      };
    }
  }
};

const updateOrderDetails = async (
  orderId: string,
  userId: string,
  address?: OrderType['shippingAddress']
): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return { message: 'Order not found', data: null, code: 404 };
    }

    if (order.status !== 'Pending') {
      return { message: 'Cannot update order data after it has been processed', data: null, code: 400 };
    }

    if (address) order.shippingAddress = address;

    await order.save();

    return { message: 'Order updated successfully', data: null, code: 200 };
  } catch (error) {
    return { message: 'Failed to update order', data: null, code: 500 };
  }
};

const cancelOrder = async (orderId: string, userId: string): Promise<CustomResponseType> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({ _id: orderId, user: userId }).session(session);

    if (!order) {
      throw new Error('Order not found.');
    }

    if (order.deliveryStatus !== 'In-Warehouse') {
      throw new Error('Order cannot be canceled. It may have already been shipped.');
    }

    // Restore stock
    const bulkUpdates = order.products.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: item.qty } },
      },
    }));

    await Product.bulkWrite(bulkUpdates, { session });

    // Update order status
    order.status = 'Cancelled';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Track order cancellation for analytics
    // This runs independently and won't affect the response time
    AnalyticsService.trackOrderReturned(orderId).catch((err) =>
      console.error('Failed to track order return analytics:', err)
    );

    return { message: 'Order canceled successfully', data: null, code: 200 };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error instanceof Error) {
      return { message: error.message || 'Failed to cancel order', data: null, code: 500 };
    } else {
      return {
        message: 'Internal server error',
        data: null,
        code: 500,
      };
    }
  }
};

const getOneOrder = async ({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}): Promise<CustomResponseType<OrderType>> => {
  try {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return { message: 'Order not found', data: null, code: 404 };
    }

    return { message: 'Order retrieved successfully', data: order, code: 200 };
  } catch (error) {
    console.error('Error fetching order:', error);
    return { message: 'Failed to fetch order', data: null, code: 500 };
  }
};

const initiateReturn = async (orderId: string, userId: string): Promise<CustomResponseType<null>> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({ _id: orderId, user: userId }).session(session);

    if (!order) {
      throw new Error('Order not found.');
    }

    if (order.deliveryStatus !== 'Delivered') {
      throw new Error('Only delivered orders can be returned.');
    }

    // Update order status to Returned
    order.deliveryStatus = 'Returned';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Track order return for analytics
    AnalyticsService.trackOrderReturned(orderId).catch((err) =>
      console.error('Failed to track order return analytics:', err)
    );

    return { message: 'Order return initiated successfully', data: null, code: 200 };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error instanceof Error) {
      return { message: error.message || 'Failed to initiate return', data: null, code: 500 };
    } else {
      return {
        message: 'Internal server error',
        data: null,
        code: 500,
      };
    }
  }
};

const getAllReturns = async ({
  userId,
  page = 1,
  limit = 10,
}: {
  userId?: string;
  page?: number;
  limit?: number;
}): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>> => {
  try {
    const pipeline = [
      { $match: { user: userId, deliveryStatus: 'Returned' } },
      {
        $facet: {
          orders: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          totalOrders: [{ $count: 'count' }],
        },
      },
    ];

    const result = await Order.aggregate(pipeline);
    const orders = result[0]?.orders || [];
    const totalOrders = result[0]?.totalOrders[0]?.count || 0;

    return {
      message: 'Returned orders retrieved successfully',
      data: { orders, totalOrders },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching returned orders:', error);
    return {
      message: 'Failed to fetch returned orders',
      data: null,
      code: 500,
    };
  }
};

const OrderService = {
  getOrderHistory,
  placeOrderWithStockValidation,
  cancelOrder,
  updateOrderDetails,
  getOneOrder,
  initiateReturn,
  getAllReturns,
};

export default OrderService;
