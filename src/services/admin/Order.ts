import mongoose from 'mongoose';
import Order, { OrderType } from '../../models/Order';
import Transaction, { TransactionStatus } from '../../models/Transaction';
import { CustomResponseType } from '@/types';
import AnalyticsService from '../MainAnalyticsService';

/**
 * Fetches orders with optional filters and pagination including transaction status.
 * @param page - Current page number (optional).
 * @param limit - Number of orders per page (optional).
 * @param filters - Filters for searching orders.
 */
const getOrders = async (
  page?: number,
  limit?: number,
  filters?: Partial<{
    status: OrderType['status'];
    deliveryStatus: OrderType['deliveryStatus'];
    orderId: string;
    customerId: string;
    dateRange: { start: Date; end: Date };
    transactionStatus: TransactionStatus | 'all';
  }>
): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>> => {
  try {
    const pipeline: mongoose.PipelineStage[] = [];
    const matchStage: Record<string, unknown> = {};

    // Apply filters if provided
    if (filters?.status) matchStage.status = filters.status;
    if (filters?.deliveryStatus) matchStage.deliveryStatus = filters.deliveryStatus;
    if (filters?.orderId) matchStage._id = filters.orderId;
    if (filters?.customerId) matchStage.user = filters.customerId;
    if (filters?.dateRange) {
      matchStage.createdAt = { $gte: filters.dateRange.start, $lte: filters.dateRange.end };
    }

    pipeline.push({ $match: matchStage });

    // Handle transaction status filtering
    if (filters?.transactionStatus && filters.transactionStatus !== 'all') {
      // Filter by specific transaction status
      pipeline.push({
        $lookup: {
          from: 'transactions',
          localField: 'transactionId',
          foreignField: '_id',
          as: 'transaction'
        }
      });
      pipeline.push({
        $match: {
          'transaction.status': filters.transactionStatus
        }
      });
    } else if (!filters?.transactionStatus || filters.transactionStatus === 'all') {
      // Default behavior: only show orders with completed transactions (paid orders)
      pipeline.push({
        $lookup: {
          from: 'transactions',
          localField: 'transactionId',
          foreignField: '_id',
          as: 'transaction'
        }
      });
      pipeline.push({
        $match: {
          'transaction.status': 'completed'
        }
      });
    }

    // Sort by creation date
    pipeline.push({ $sort: { createdAt: -1 } });

    // Count total documents
    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Order.aggregate(countPipeline);
    const totalOrders = totalResult[0]?.total || 0;

    // Add pagination if specified
    if (page && limit) {
      pipeline.push(
        { $skip: (page - 1) * limit },
        { $limit: limit }
      );
    }

    // Remove transaction field from final result (keeping it lean)
    pipeline.push({
      $project: {
        transaction: 0
      }
    });

    const orders = await Order.aggregate(pipeline);

    return {
      message: 'Orders retrieved successfully',
      data: { orders, totalOrders },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return {
      message: 'Failed to fetch orders',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches an order by its ID.
 * @param orderId - The ID of the order to fetch.
 */
const getOrderById = async (orderId: string): Promise<CustomResponseType<OrderType>> => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Order retrieved successfully',
      data: order,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    return {
      message: 'Failed to fetch order',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates order details for admin.
 * @param orderId - The ID of the order to update.
 * @param updates - The fields to update.
 */
const updateOrderDetails = async (
  orderId: string,
  updates: Partial<
    Pick<OrderType, 'shippingProgress' | 'deliveryStatus' | 'status' | 'products' | 'shippingAddress' | 'deliveredAt'>
  >
): Promise<CustomResponseType<null>> => {
  try {
    const previousOrder = await Order.findById(orderId);
    if (!previousOrder) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }

    await Order.findByIdAndUpdate(orderId, updates, { new: true });

    // Track analytics for status changes
    if (updates.status && previousOrder.status !== updates.status) {
      // If the order was completed, track it as a successful sale
      if (updates.status === 'Completed') {
        AnalyticsService.trackOrderCompleted(orderId, previousOrder.total).catch((err) =>
          console.error('Failed to track order completion analytics:', err)
        );
      }
    }

    // Track analytics for delivery status changes
    if (updates.deliveryStatus && previousOrder.deliveryStatus !== updates.deliveryStatus) {
      // Track returned orders for analytics
      if (updates.deliveryStatus === 'Returned') {
        AnalyticsService.trackOrderReturned(orderId).catch((err) =>
          console.error('Failed to track order return analytics:', err)
        );
      }
    }

    return {
      message: 'Order updated successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating order details:', error);
    return {
      message: 'Failed to update order',
      data: null,
      code: 500,
    };
  }
};

/**
 * Cancels an order by its ID.
 * @param orderId - The ID of the order to cancel.
 */
const cancelOrder = async (orderId: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndDelete(orderId);
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    // Track order cancellation analytics
    AnalyticsService.trackOrderReturned(orderId).catch((err) =>
      console.error('Failed to track order cancellation analytics:', err)
    );
    return {
      message: 'Order canceled successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error canceling order:', error);
    return {
      message: 'Failed to cancel order',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates the delivery timeline of an order.
 * @param orderId - The ID of the order to update.
 * @param timeline - The new delivery timeline.
 */
const updateDeliveryTimeline = async (orderId: string, timeline: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndUpdate(orderId, { timeline });
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Delivery timeline updated successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating delivery timeline:', error);
    return {
      message: 'Failed to update delivery timeline',
      data: null,
      code: 500,
    };
  }
};

/**
 * Rejects an order by its ID.
 * @param orderId - The ID of the order to reject.
 */
const rejectOrder = async (orderId: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndUpdate(orderId, { status: 'Not Processed' });
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Order rejected successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error rejecting order:', error);
    return {
      message: 'Failed to reject order',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches all returned orders.
 */
const getAllReturns = async ({
  page = 1,
  limit = 10,
}: {
  page?: number;
  limit?: number;
}): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>> => {
  try {
    const skip = (page - 1) * limit;
    const [returnedOrders, totalOrders] = await Promise.all([
      Order.find({ deliveryStatus: 'Returned' }).skip(skip).limit(limit),
      Order.countDocuments({ deliveryStatus: 'Returned' }),
    ]);

    return {
      message: 'Returned orders retrieved successfully',
      data: { orders: returnedOrders, totalOrders },
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

/**
 * Fetches the 15 most ordered products within a specified time frame.
 * @param startDate - The start date of the time frame.
 * @param endDate - The end date of the time frame.
 */
const getTopOrderedProducts = async (
  startDate: Date,
  endDate: Date
): Promise<CustomResponseType<{ productId: string; totalQuantity: number }[]>> => {
  try {
    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $unwind: '$products',
      },
      {
        $group: {
          _id: '$products.product',
          totalQuantity: { $sum: '$products.qty' },
        },
      },
      {
        $sort: { totalQuantity: -1 },
      },
      {
        $limit: 15,
      },
    ]);

    return {
      message: 'Top ordered products retrieved successfully',
      data: result.map((item) => ({ productId: item._id, totalQuantity: item.totalQuantity })),
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching top ordered products:', error);
    return {
      message: 'Failed to fetch top ordered products',
      data: null,
      code: 500,
    };
  }
};

const OrderService = {
  getOrderById,
  cancelOrder,
  updateDeliveryTimeline,
  rejectOrder,
  updateOrderDetails,
  getOrders,
  getAllReturns,
  getTopOrderedProducts,
};

export default OrderService;
