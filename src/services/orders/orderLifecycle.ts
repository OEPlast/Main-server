import mongoose from 'mongoose';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Transaction, { ITransaction } from '@/models/Transaction';
import User from '@/models/User';
import ShipmentService from '@/services/ShipmentService';
import GIGService from '@/services/GIGService';
import eventPublisher from '@/events/eventPublisher';
import { loadOrderEmailContext, toOrderConfirmation } from '@/services/email/orderEmailPayload';
import { flagTransactionForReview, refundTransaction } from '@/services/payments/refunds';
import { orderStatusUpdate, OrderStatusValue } from '@/utils/orderStatusTimestamps';
import { logger } from '@/lib/logger';
import type { CustomResponseType } from '@/types';
import { announceReleasedInventory, releaseOrderInventoryInSession } from './orderInventory';

export { REFUND_ETA_DAYS } from '@/config/storePolicies';
import { REFUND_ETA_DAYS } from '@/config/storePolicies';

/**
 * Which status changes an order may make. `updateOrderDetails` used to write any status over any
 * other, so a cancelled order could be moved back to Processing, or a completed one to Pending.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  Pending: ['Processing', 'Cancelled', 'Failed'],
  Processing: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
  Failed: [],
};

export function canTransition(from: string, to: OrderStatusValue): boolean {
  return from === to || (ALLOWED_TRANSITIONS[from as OrderStatusValue] ?? []).includes(to);
}

type OrderDocument = NonNullable<Awaited<ReturnType<typeof markOrderPaid>>>;

/**
 * Marks an unpaid order paid, atomically. Returns the order when this call made the change, or
 * null when the order was already paid, cancelled or gone, so exactly one caller runs fulfilment.
 * Processing is accepted as well as Pending because staff can move an unpaid order on by hand.
 */
export async function markOrderPaid(orderId: string | mongoose.Types.ObjectId, paidAt: Date) {
  return Order.findOneAndUpdate(
    { _id: orderId, isPaid: false, status: { $in: ['Pending', 'Processing'] } },
    { $set: { isPaid: true, paidAt, status: 'Processing' } },
    { new: true }
  );
}

/**
 * Books the GIG pickup for a paid order.
 *
 * This used to run at checkout, before payment, so every abandoned GIG checkout booked a courier
 * shipment that was never cancelled.
 */
async function createGigPreshipment(order: OrderDocument): Promise<void> {
  const address = order.shippingAddress;
  if (order.gigWaybill || !address) return;

  const lines = order.products.filter((item) => item.product && item.qty);
  const products = await Product.find({ _id: { $in: lines.map((item) => item.product) } })
    .select('name weight height width length isVolumetric description_images')
    .lean();
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  const receiverEmail =
    order.guestContact?.email ?? (await User.findById(order.user).select('email').lean())?.email ?? undefined;

  const result = await GIGService.createShipmentForOrder({
    items: lines.map((item) => {
      const product = productById.get(item.product!.toString());
      return {
        name: product?.name || 'Product',
        quantity: item.qty!,
        weight: product?.weight ?? 1,
        height: product?.height ?? 10,
        width: product?.width ?? 10,
        length: product?.length ?? 10,
        isVolumetric: product?.isVolumetric ?? false,
        value: item.price || 0,
        imageUrl:
          product?.description_images?.find((img: { cover_image?: boolean }) => img.cover_image)?.url || '',
      };
    }),
    receiverAddress: address.address1 || '',
    receiverState: address.state || '',
    receiverCity: address.city || undefined,
    receiverLatitude: address.latitude ?? undefined,
    receiverLongitude: address.longitude ?? undefined,
    receiverName: `${address.firstName || ''} ${address.lastName || ''}`.trim(),
    receiverPhoneNumber: address.phoneNumber || '',
    receiverEmail,
  });

  if (result.data?.waybillNumber) {
    await Order.updateOne({ _id: order._id }, { $set: { gigWaybill: result.data.waybillNumber } });
    order.gigWaybill = result.data.waybillNumber;
    logger.info(`GIG preshipment ${result.data.waybillNumber} created for order ${order._id.toString()}`);
  } else {
    logger.warn(`GIG preshipment failed for order ${order._id.toString()}: ${result.message}`);
  }
}

/**
 * Everything that follows a confirmed payment: courier booking, confirmation and receipt emails,
 * and the live order update. Runs once per order, because only the caller that won markOrderPaid
 * calls it. Failures here are logged, never thrown: the customer has paid either way.
 */
export async function fulfilPaidOrder(order: OrderDocument, transaction: ITransaction): Promise<void> {
  const orderId = order._id.toString();

  try {
    if (order.deliveryType === 'shipping') {
      const shipment = await ShipmentService.createShipmentForOrder(orderId);
      if (shipment) logger.info(`Shipment created for order ${orderId} - Tracking: ${shipment.trackingNumber}`);
    } else if (order.deliveryType === 'gig') {
      await createGigPreshipment(order);
    }
  } catch (error) {
    logger.error(`Courier booking failed for paid order ${orderId}: ${(error as Error).message}`);
  }

  try {
    const context = await loadOrderEmailContext(orderId);
    if (context) {
      await eventPublisher.publishOrderSuccessful(toOrderConfirmation(context));
    }
    await eventPublisher.publishPaymentSuccessful({
      orderId,
      userId: transaction.userId.toString(),
      paymentId: (transaction._id as mongoose.Types.ObjectId).toString(),
      amount: transaction.amount,
      paymentMethod: 'paystack',
      orderNumber: context?.orderNumber,
      email: context?.email,
      firstName: context?.firstName,
      lastName: context?.lastName,
      purchaseDate: context?.purchaseDate,
      paidAt: transaction.paidAt ?? new Date(),
      paymentReference: transaction.reference,
      orderStatusLink: context?.links.order,
    });
    await eventPublisher.publishWebsocketOrderUpdate({ orderId, status: 'paid' });
  } catch (error) {
    logger.error(`Could not publish paid-order events for ${orderId}:`, error);
  }
}

export type CancelledBy = 'customer' | 'admin' | 'system';

/**
 * What happens to money already taken when a paid order is cancelled.
 * - refund_now: refund through Paystack as part of the cancellation (admin cancel/reject).
 * - await_staff: flag the payment so staff authorize the refund (customer cancel).
 */
export type PaidCancellationRefund = 'refund_now' | 'await_staff';

export type CancelOrderResult = {
  refund: 'not_paid' | 'requested' | 'awaiting_staff' | 'failed';
  refundMessage?: string;
};

/**
 * Cancels an order. The one cancellation path for customers, staff and the system.
 *
 * Replaces three that disagreed: customer cancel restored stock but refunded nothing, admin cancel
 * deleted the order (no stock back, no refund, a transaction pointing at nothing), and admin reject
 * set Cancelled without touching stock or money.
 */
export async function cancelOrder(input: {
  orderId: string;
  by: CancelledBy;
  refund: PaidCancellationRefund;
  notifyCustomer: boolean;
  /** Restricts the cancellation to this customer's own order. */
  customerId?: string;
  reason?: string;
  /** Recorded on any refund this cancellation starts. */
  adminId?: string;
}): Promise<CustomResponseType<CancelOrderResult>> {
  if (!mongoose.Types.ObjectId.isValid(input.orderId)) {
    return { message: 'Order not found', data: null, code: 404 };
  }

  const order = await Order.findOne({
    _id: input.orderId,
    ...(input.customerId ? { user: input.customerId } : {}),
  });
  if (!order) {
    return { message: 'Order not found', data: null, code: 404 };
  }
  if (order.status === 'Cancelled') {
    return { message: 'This order has already been cancelled', data: null, code: 400 };
  }
  if (!canTransition(order.status, 'Cancelled')) {
    return { message: `A ${order.status.toLowerCase()} order cannot be cancelled`, data: null, code: 400 };
  }

  if (input.by === 'customer' && order.shipmentId) {
    const deliveryStatus = await ShipmentService.getDeliveryStatus(input.orderId);
    if (['Shipped', 'Dispatched', 'In-Transit', 'Delivered'].includes(deliveryStatus)) {
      return { message: 'This order has already been shipped and can no longer be cancelled', data: null, code: 400 };
    }
  }

  // The status change and the stock release commit together or not at all, so a failure can never
  // leave a cancelled order still holding stock. The status update is a compare-and-set on what we
  // read: if a payment or another cancel changed the order meanwhile, nothing happens and the caller
  // is told to retry against the new state.
  let cancelled: OrderDocument | null = null;
  let releasedProductIds: string[] = [];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      releasedProductIds = [];
      cancelled = await Order.findOneAndUpdate(
        { _id: order._id, status: order.status, isPaid: order.isPaid },
        { $set: orderStatusUpdate('Cancelled') },
        { new: true, session }
      );
      if (!cancelled) return;
      releasedProductIds = (await releaseOrderInventoryInSession(cancelled._id as mongoose.Types.ObjectId, session))
        .productIds;
    });
  } catch (error) {
    logger.error(`Cancelling order ${input.orderId} failed; nothing was changed:`, error);
    return { message: 'The order could not be cancelled. Please try again.', data: null, code: 500 };
  } finally {
    await session.endSession();
  }

  if (!cancelled) {
    return { message: 'This order changed while it was being cancelled. Please try again.', data: null, code: 409 };
  }
  // TypeScript does not track the assignment inside the transaction callback.
  cancelled = cancelled as OrderDocument;
  announceReleasedInventory(releasedProductIds);

  const result: CancelOrderResult = { refund: 'not_paid' };

  if (cancelled.isPaid) {
    const payment = await Transaction.findOne({
      orderId: cancelled._id,
      transactionType: 'order_payment',
      status: { $in: ['completed', 'partially_refunded'] },
    });

    if (!payment) {
      result.refund = 'failed';
      result.refundMessage = 'No refundable payment was found for this order';
      logger.error(`Paid order ${input.orderId} was cancelled but has no refundable payment record`);
    } else if (input.refund === 'refund_now') {
      const refund = await refundTransaction({
        transactionId: payment._id as mongoose.Types.ObjectId,
        reason: input.reason ? `Order cancelled: ${input.reason}` : 'Order cancelled',
        initiatedBy: input.adminId ?? input.by,
      });
      if (refund.code === 200) {
        result.refund = 'requested';
      } else {
        result.refund = 'failed';
        result.refundMessage = refund.message;
        await flagTransactionForReview(
          payment._id as mongoose.Types.ObjectId,
          `Order cancelled by ${input.by}, but the refund failed: ${refund.message}`
        );
      }
    } else {
      result.refund = 'awaiting_staff';
      await flagTransactionForReview(
        payment._id as mongoose.Types.ObjectId,
        'Paid order cancelled by the customer. Refund awaits staff approval.'
      );
    }
  }


  if (input.notifyCustomer) {
    const context = await loadOrderEmailContext(input.orderId);
    if (context) {
      await eventPublisher
        .publishOrderCancelled({
          userId: cancelled.user.toString(),
          email: context.email,
          firstName: context.firstName,
          lastName: context.lastName,
          orderId: context.orderId,
          orderNumber: context.orderNumber,
          purchaseDate: context.purchaseDate,
          cancelledAt: cancelled.cancelledAt ?? new Date(),
          reason: input.reason,
          products: context.products,
          // Only promise a refund when money was taken and the refund is under way or approved.
          refundAmount: result.refund === 'requested' || result.refund === 'awaiting_staff' ? context.payment.subtotal : undefined,
          refundEtaDays: result.refund === 'requested' ? REFUND_ETA_DAYS : undefined,
          shopLink: context.links.shop,
        })
        .catch((err) => logger.error('Failed to publish order cancellation event:', err));
    }
  }

  await eventPublisher
    .publishWebsocketOrderUpdate({ orderId: input.orderId, status: 'cancelled' })
    .catch((err) => logger.error('Failed to publish cancellation update:', err));

  const message =
    result.refund === 'requested'
      ? 'Order cancelled and the refund has been requested from Paystack'
      : result.refund === 'awaiting_staff'
        ? 'Order cancelled. Your refund will be processed once our team approves it.'
        : result.refund === 'failed'
          ? `Order cancelled, but the refund could not be started: ${result.refundMessage}. It has been flagged for review.`
          : 'Order cancelled successfully';

  return { message, data: result, code: 200 };
}
