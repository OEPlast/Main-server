import Order, { OrderType } from '../../models/Order';
import { CustomResponseType } from '../../types';

/**
 * Fetches orders with optional filters and pagination.
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
  }>
): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>> => {
  try {
    const matchStage: Record<string, unknown> = {};

    // Apply filters if provided
    if (filters?.status) matchStage.status = filters.status;
    if (filters?.deliveryStatus) matchStage.deliveryStatus = filters.deliveryStatus;
    if (filters?.orderId) matchStage._id = filters.orderId;
    if (filters?.customerId) matchStage.user = filters.customerId;
    if (filters?.dateRange) {
      matchStage.createdAt = { $gte: filters.dateRange.start, $lte: filters.dateRange.end };
    }

    // Aggregation pipeline
    const aggregationPipeline = [
      { $match: matchStage }, // Apply filters
      { $sort: { createdAt: -1 as 1 } }, // Sort by latest
      ...(page && limit ? [{ $skip: (page - 1) * limit }, { $limit: limit }] : []), // Pagination
      {
        $facet: {
          orders: [],
          totalOrders: [{ $count: 'count' }],
        },
      },
    ];

    // Run aggregation
    const result = await Order.aggregate(aggregationPipeline);

    // Extract results
    const orders = result[0]?.orders || [];
    const totalOrders = result[0]?.totalOrders[0]?.count || 0;

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
    const order = await Order.findByIdAndUpdate(orderId, updates);

    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
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

const OrderService = {
  getOrderById,
  cancelOrder,
  updateDeliveryTimeline,
  rejectOrder,
  updateOrderDetails,
  getOrders,
};

export default OrderService;
