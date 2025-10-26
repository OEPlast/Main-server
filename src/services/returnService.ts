import Return from '../models/Return';
import Order from '../models/Order';
import mongoose from 'mongoose';
import { CustomResponseType, CustomResponseTypeWithMeta } from '../types/index';

// Type aliases
type ReturnType = any;

// Input interfaces
interface InitiateReturnInput {
  orderId: string;
  userId: string;
  items: Array<{
    product: string;
    qty: number;
    reason: string;
    reasonDetails?: string;
    images?: string[];
  }>;
  type: 'refund' | 'exchange';
  customerNotes?: string;
}

interface GetReturnsInput {
  status?: string;
  userId?: string;
  orderId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface UpdateReturnStatusInput {
  status: string;
  adminNotes?: string;
  refundAmount?: number;
}

// Service methods
const initiateReturn = async (
  returnData: InitiateReturnInput
): Promise<CustomResponseType<ReturnType>> => {
  try {
    const { orderId, userId, items, type, customerNotes } = returnData;

    // Validate order exists and belongs to user
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return {
        message: 'Order not found or does not belong to user',
        data: null,
        code: 404,
      };
    }

    // Check if order is delivered
    if (order.status !== 'Completed') {
      return {
        message: 'Only completed orders can be returned',
        data: null,
        code: 400,
      };
    }

    // Check return window (7 days)
    const returnWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const deliveryDate = order.deliveredAt || order.createdAt;
    if (Date.now() - deliveryDate.getTime() > returnWindow) {
      return {
        message: 'Return window has expired (7 days from delivery)',
        data: null,
        code: 400,
      };
    }

    // Validate items exist in order
    for (const item of items) {
      const orderItem = order.products.find(
        (p: any) => p.product.toString() === item.product
      );
      if (!orderItem) {
        return {
          message: `Product ${item.product} not found in order`,
          data: null,
          code: 400,
        };
      }
      if (orderItem.qty && item.qty > orderItem.qty) {
        return {
          message: `Cannot return more than purchased quantity for product ${item.product}`,
          data: null,
          code: 400,
        };
      }
    }

    // Create return
    const returnDoc = await Return.create({
      order: orderId,
      user: userId,
      items,
      type,
      customerNotes,
      status: 'pending',
    });

    return {
      message: 'Return initiated successfully',
      data: returnDoc,
      code: 201,
    };
  } catch (error) {
    console.error('Error initiating return:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to initiate return',
      data: null,
      code: 500,
    };
  }
};

const getReturns = async (
  searchParams?: GetReturnsInput
): Promise<CustomResponseTypeWithMeta<
  ReturnType[],
  { page: number; limit: number; total: number; pages: number }
>> => {
  try {
    const {
      status,
      userId,
      orderId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = searchParams || {};

    // Build query filters
    const filter: Record<string, any> = {};

    if (status) filter.status = status;
    if (userId) filter.user = new mongoose.Types.ObjectId(userId);
    if (orderId) filter.order = new mongoose.Types.ObjectId(orderId);

    if (startDate || endDate) {
      filter.requestedAt = {};
      if (startDate) filter.requestedAt.$gte = new Date(startDate);
      if (endDate) filter.requestedAt.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { 'items.reason': { $regex: search, $options: 'i' } },
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [returns, total] = await Promise.all([
      Return.find(filter)
        .populate('user', 'firstName lastName email phoneNumber')
        .populate('order', '_id orderNumber total createdAt')
        .populate('items.product', '_id name slug description_images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Return.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limit);

    return {
      message: 'Returns fetched successfully',
      data: returns,
      code: 200,
      meta: { page, limit, total, pages },
    };
  } catch (error) {
    console.error('Error fetching returns:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch returns',
      data: [],
      code: 500,
      meta: { page: 1, limit: 0, total: 0, pages: 0 },
    };
  }
};

const getReturnById = async (
  id: string,
  populateAll = true
): Promise<CustomResponseType<ReturnType>> => {
  try {
    const query = Return.findById(id);

    if (populateAll) {
      query
        .populate('user', 'firstName lastName email phoneNumber')
        .populate('order', '_id orderNumber total products createdAt deliveredAt')
        .populate('items.product', '_id name slug description_images price')
        .populate('refundTransaction');
    }

    const returnDoc = await query.lean();

    if (!returnDoc) {
      return {
        message: 'Return not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Return fetched successfully',
      data: returnDoc,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching return:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch return',
      data: null,
      code: 500,
    };
  }
};

const updateReturnStatus = async (
  id: string,
  updateData: UpdateReturnStatusInput
): Promise<CustomResponseType<ReturnType>> => {
  try {
    const { status, adminNotes, refundAmount } = updateData;

    const returnDoc = await Return.findById(id);
    if (!returnDoc) {
      return {
        message: 'Return not found',
        data: null,
        code: 404,
      };
    }

    // Update fields
    returnDoc.status = status as any;
    if (adminNotes) returnDoc.adminNotes = adminNotes;

    if (refundAmount !== undefined) {
      returnDoc.totalRefundAmount = refundAmount;
      // Distribute refund amount across items proportionally
      const totalItemsQty = returnDoc.items.reduce((sum, item) => sum + item.qty, 0);
      returnDoc.items.forEach((item) => {
        item.refundAmount = (refundAmount / totalItemsQty) * item.qty;
      });
    }

    await returnDoc.save();

    return {
      message: 'Return status updated successfully',
      data: returnDoc,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating return status:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to update return status',
      data: null,
      code: 500,
    };
  }
};

const cancelReturn = async (
  id: string,
  userId: string
): Promise<CustomResponseType<ReturnType>> => {
  try {
    const returnDoc = await Return.findOne({ _id: id, user: userId });
    if (!returnDoc) {
      return {
        message: 'Return not found or does not belong to user',
        data: null,
        code: 404,
      };
    }

    // Only allow cancellation for pending status
    if (returnDoc.status !== 'pending') {
      return {
        message: 'Return cannot be cancelled at this stage',
        data: null,
        code: 400,
      };
    }

    returnDoc.status = 'cancelled';
    returnDoc.adminNotes = 'Cancelled by customer';
    await returnDoc.save();

    return {
      message: 'Return cancelled successfully',
      data: returnDoc,
      code: 200,
    };
  } catch (error) {
    console.error('Error cancelling return:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to cancel return',
      data: null,
      code: 500,
    };
  }
};

const deleteReturn = async (id: string): Promise<CustomResponseType<null>> => {
  try {
    const returnDoc = await Return.findByIdAndDelete(id);
    if (!returnDoc) {
      return {
        message: 'Return not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Return deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting return:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to delete return',
      data: null,
      code: 500,
    };
  }
};

const getReturnsStatistics = async (): Promise<CustomResponseType<any>> => {
  try {
    const [
      totalReturns,
      pendingReturns,
      approvedReturns,
      rejectedReturns,
      completedReturns,
      totalRefundAmount,
      returnsByReason,
    ] = await Promise.all([
      Return.countDocuments(),
      Return.countDocuments({ status: 'pending' }),
      Return.countDocuments({ status: 'approved' }),
      Return.countDocuments({ status: 'rejected' }),
      Return.countDocuments({ status: 'completed' }),
      Return.aggregate([
        { $match: { status: 'completed', totalRefundAmount: { $ne: null } } },
        { $group: { _id: null, total: { $sum: '$totalRefundAmount' } } },
      ]),
      Return.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.reason', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const statistics = {
      totalReturns,
      pendingReturns,
      approvedReturns,
      rejectedReturns,
      completedReturns,
      totalRefundAmount: totalRefundAmount[0]?.total || 0,
      returnsByReason,
    };

    return {
      message: 'Returns statistics fetched successfully',
      data: statistics,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching returns statistics:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch returns statistics',
      data: null,
      code: 500,
    };
  }
};

// Export service
const ReturnService = {
  initiateReturn,
  getReturns,
  getReturnById,
  updateReturnStatus,
  cancelReturn,
  deleteReturn,
  getReturnsStatistics,
};

export default ReturnService;
