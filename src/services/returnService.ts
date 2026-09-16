import Return, { IReturn } from '../models/Return';
import { RETURN_WINDOW_DAYS } from './email/orderEmailPayload';
import { escapeRegex } from '@/helpers/regex';
import Order from '../models/Order';
import mongoose from 'mongoose';
import { CustomResponseType, CustomResponseTypeWithMeta } from '../types/index';
import { fireAndLog, sendReturnRequested, sendReturnStatus } from './email/returnEmails';

/**
 * What the customer is likely to get back, from the prices actually charged on the order.
 * Shown as a guide in the acknowledgement email; the real figure is set after inspection.
 */
const estimateRefund = (
  orderProducts: Array<{ product?: unknown; qty?: number | null; price?: number | null }>,
  items: Array<{ product: string; qty: number }>
): number | undefined => {
  const total = items.reduce((sum, item) => {
    const line = orderProducts.find((p) => String(p.product) === item.product);
    return sum + (line?.price ?? 0) * item.qty;
  }, 0);

  return total > 0 ? total : undefined;
};

// Type aliases
type ReturnType = any;

/** Who moved a return: the customer, a staff member (by id) or the system. */
export type ReturnActor = { kind: 'customer' | 'admin' | 'system'; id?: string };
const actorLabel = (actor: ReturnActor): string => (actor.id ? `${actor.kind}:${actor.id}` : actor.kind);

type ReturnStatus = IReturn['status'];

/**
 * The statuses a return may move between. `updateReturnStatus` used to write whatever it was
 * handed, so a completed (refunded) return could be moved back to pending and refunded again.
 *
 * `completed` means "refunded", so it is only reachable once a refund transaction is attached
 * (see the guard in updateReturnStatus); the refund endpoint is what sets it.
 */
const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['items_received', 'cancelled'],
  items_received: ['inspecting', 'inspection_passed', 'inspection_failed'],
  inspecting: ['inspection_passed', 'inspection_failed'],
  inspection_passed: ['completed'],
  inspection_failed: ['rejected', 'completed'],
  rejected: [],
  completed: [],
  cancelled: [],
};

/** Statuses a refund may be paid from without an override. */
export const REFUNDABLE_RETURN_STATUSES: ReturnStatus[] = ['inspection_passed'];
/** Statuses a refund may be paid from with a written override (goods waived). */
export const OVERRIDABLE_RETURN_STATUSES: ReturnStatus[] = ['approved', 'items_received', 'inspecting', 'inspection_failed'];

export function canTransitionReturn(from: ReturnStatus, to: ReturnStatus): boolean {
  return RETURN_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Live (not soft-deleted) returns only. Every read goes through this. */
const NOT_DELETED = { deleted: { $ne: true } } as const;

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

    // Exchanges have no replacement-order flow yet; accepting them created returns nobody could
    // complete. Refund only for now.
    if (type === 'exchange') {
      return {
        message: 'Exchanges are not available yet. Please request a refund and place a new order.',
        data: null,
        code: 400,
      };
    }

    // Check if order is delivered
    if (order.status !== 'Completed' || !order.isPaid) {
      return {
        message: 'Only delivered, paid orders can be returned',
        data: null,
        code: 400,
      };
    }

    // Check return window. deliveredAt is stamped on every delivery now (services/orders/delivery);
    // older orders fall back to completedAt, then to the order date.
    const returnWindow = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const deliveryDate = order.deliveredAt || order.completedAt || order.createdAt;
    if (Date.now() - deliveryDate.getTime() > returnWindow) {
      return {
        message: `Return window has expired (${RETURN_WINDOW_DAYS} days from delivery)`,
        data: null,
        code: 400,
      };
    }

    // Quantities already claimed by this order's other open or completed returns. Without this a
    // customer could return the same unit twice across two requests.
    const priorReturns = await Return.find({
      order: orderId,
      status: { $nin: ['rejected', 'cancelled'] },
      ...NOT_DELETED,
    })
      .select('items.product items.qty')
      .lean();
    const alreadyReturned = new Map<string, number>();
    for (const prior of priorReturns) {
      for (const line of prior.items) {
        const key = String(line.product);
        alreadyReturned.set(key, (alreadyReturned.get(key) ?? 0) + line.qty);
      }
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
      const remaining = (orderItem.qty ?? 0) - (alreadyReturned.get(item.product) ?? 0);
      if (item.qty > remaining) {
        return {
          message:
            remaining <= 0
              ? `Every unit of this product has already been included in a return`
              : `Only ${remaining} unit(s) of this product can still be returned`,
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
      statusHistory: [{ status: 'pending', at: new Date(), by: `customer:${userId}` }],
    });

    // Acknowledge the request. Until now a customer submitted a return and heard nothing —
    // no confirmation it had been received, and no return number to quote.
    fireAndLog(
      sendReturnRequested({
        orderId,
        returnId: String(returnDoc._id),
        returnNumber: returnDoc.returnNumber,
        returnType: type,
        items: returnDoc.items,
        orderLineIds: order.products.map((p: any) => String(p.product)),
        requestedAt: returnDoc.requestedAt ?? returnDoc.createdAt,
        reason: items[0]?.reason,
        estimatedRefund: estimateRefund(order.products as any[], items),
      }),
      `return-requested for ${returnDoc.returnNumber}`
    );

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
    const filter: Record<string, any> = { ...NOT_DELETED };

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
        { returnNumber: { $regex: escapeRegex(search), $options: 'i' } },
        { 'items.reason': { $regex: escapeRegex(search), $options: 'i' } },
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
    const query = Return.findOne({ _id: id, ...NOT_DELETED });

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
  updateData: UpdateReturnStatusInput,
  actor: ReturnActor = { kind: 'system' }
): Promise<CustomResponseType<ReturnType>> => {
  try {
    const { status, adminNotes, refundAmount } = updateData;
    const nextStatus = status as ReturnStatus;

    const returnDoc = await Return.findOne({ _id: id, ...NOT_DELETED });
    if (!returnDoc) {
      return {
        message: 'Return not found',
        data: null,
        code: 404,
      };
    }

    const statusChanged = nextStatus !== returnDoc.status;
    if (statusChanged && !canTransitionReturn(returnDoc.status, nextStatus)) {
      return {
        message: `A return can't move from ${returnDoc.status} to ${nextStatus}`,
        data: null,
        code: 400,
      };
    }
    if (statusChanged && nextStatus === 'completed' && !returnDoc.refundTransaction) {
      return {
        message: 'A return is completed by paying its refund. Use the refund action instead of setting the status.',
        data: null,
        code: 400,
      };
    }

    // Update fields
    if (statusChanged) {
      returnDoc.status = nextStatus;
      returnDoc.statusHistory.push({ status: nextStatus, at: new Date(), by: actorLabel(actor), note: adminNotes });
    }
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

    // Tell the customer about a status change. Every one of these statuses was previously a silent
    // database write — including rejection, where the admin's reason existed only in `adminNotes`
    // and was never shown to the person it concerned. A note-only edit sends nothing.
    if (statusChanged) {
      const order = await Order.findById(returnDoc.order).select('products').lean();
      fireAndLog(
        sendReturnStatus({
          orderId: String(returnDoc.order),
          returnId: String(returnDoc._id),
          returnNumber: returnDoc.returnNumber,
          returnType: returnDoc.type,
          status: returnDoc.status,
          updatedAt: returnDoc.updatedAt ?? new Date(),
          items: returnDoc.items,
          orderLineIds: (order?.products ?? []).map((p: any) => p.product.toString()),
          adminNotes,
          refundAmount: returnDoc.totalRefundAmount ?? undefined,
        }),
        `return-status (${returnDoc.status}) for ${returnDoc.returnNumber}`
      );
    }

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
    const returnDoc = await Return.findOne({ _id: id, user: userId, ...NOT_DELETED });
    if (!returnDoc) {
      return {
        message: 'Return not found or does not belong to user',
        data: null,
        code: 404,
      };
    }

    // A customer can withdraw until the goods are on their way back to us.
    if (!canTransitionReturn(returnDoc.status, 'cancelled')) {
      return {
        message: 'Return cannot be cancelled at this stage',
        data: null,
        code: 400,
      };
    }

    returnDoc.status = 'cancelled';
    returnDoc.statusHistory.push({ status: 'cancelled', at: new Date(), by: `customer:${userId}`, note: 'Cancelled by customer' });
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

/**
 * Hides a return from every list. It used to be removed outright, which also destroyed the record
 * of any refund paid against it. Only finished returns can be deleted; an open one must be
 * rejected or cancelled first so the customer is told.
 */
const deleteReturn = async (id: string, actor: ReturnActor = { kind: 'system' }): Promise<CustomResponseType<null>> => {
  try {
    const returnDoc = await Return.findOne({ _id: id, ...NOT_DELETED }).select('status');
    if (!returnDoc) {
      return {
        message: 'Return not found',
        data: null,
        code: 404,
      };
    }
    if (!['rejected', 'cancelled', 'completed'].includes(returnDoc.status)) {
      return {
        message: `A ${returnDoc.status} return can't be deleted. Reject or cancel it first.`,
        data: null,
        code: 400,
      };
    }

    await Return.updateOne(
      { _id: id },
      { $set: { deleted: true, deletedAt: new Date(), deletedBy: actorLabel(actor) } }
    );

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
      Return.countDocuments({ ...NOT_DELETED }),
      Return.countDocuments({ status: 'pending', ...NOT_DELETED }),
      Return.countDocuments({ status: 'approved', ...NOT_DELETED }),
      Return.countDocuments({ status: 'rejected', ...NOT_DELETED }),
      Return.countDocuments({ status: 'completed', ...NOT_DELETED }),
      Return.aggregate([
        { $match: { status: 'completed', totalRefundAmount: { $ne: null }, ...NOT_DELETED } },
        { $group: { _id: null, total: { $sum: '$totalRefundAmount' } } },
      ]),
      Return.aggregate([
        { $match: { ...NOT_DELETED } },
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
