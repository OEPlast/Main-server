import mongoose from 'mongoose';
import Order from '@/models/Order';
import { eventPublisher } from '@/events';
import { loadOrderEmailContext, RETURN_WINDOW_DAYS } from '@/services/email/orderEmailPayload';
import { logger } from '@/lib/logger';

/** The parts of a shipment a delivery needs. Both the Mongoose document and the cron's lean doc fit. */
export interface DeliveredShipment {
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId };
  courier?: string | null;
  trackingNumber?: string | null;
  deliveredOn?: Date | null;
  shippingAddress?: { address1?: string | null } | null;
}

/**
 * Records that an order reached the customer, once, and tells everyone who cares.
 *
 * Both delivery paths used to stop short. The admin's status change stamped `completedAt` but
 * never `deliveredAt`, so the 7-day return window was counted from the day the order was placed;
 * the GIG tracking job updated only the shipment, so a GIG order never became Completed and its
 * customer got no delivered email, no review request and no return window at all.
 *
 * `deliveredAt` is claimed with one conditional update, so a courier status that flaps back to
 * Delivered, or the admin and the tracking job both reporting it, produce a single event. The
 * order becomes Completed unless it was already cancelled, in which case only the delivery time is
 * kept for the record.
 *
 * @returns true when this call recorded the delivery, false when it was already recorded
 */
export async function markOrderDelivered(
  shipment: DeliveredShipment,
  options: { deliveredAt?: Date; source: 'admin' | 'tracking-sync' }
): Promise<boolean> {
  const orderId = '_id' in shipment.orderId ? shipment.orderId._id : shipment.orderId;
  const deliveredAt = options.deliveredAt ?? shipment.deliveredOn ?? new Date();

  const order = await Order.findOneAndUpdate({ _id: orderId, deliveredAt: { $exists: false } }, [
    {
      $set: {
        deliveredAt,
        status: { $cond: [{ $in: ['$status', ['Pending', 'Processing']] }, 'Completed', '$status'] },
        completedAt: { $cond: [{ $in: ['$status', ['Pending', 'Processing']] }, deliveredAt, '$completedAt'] },
      },
    },
  ]);
  if (!order) return false;

  logger.info(`[${options.source}] Order ${orderId.toString()} delivered (was ${order.status})`);

  try {
    const context = await loadOrderEmailContext(orderId.toString());
    if (context) {
      await eventPublisher.publishOrderDelivered({
        email: context.email,
        firstName: context.firstName,
        lastName: context.lastName,
        orderId: context.orderId,
        orderNumber: context.orderNumber,
        purchaseDate: context.purchaseDate,
        products: context.products,
        deliveredAt: deliveredAt.toISOString(),
        courierName: shipment.courier || undefined,
        deliveryAddress: shipment.shippingAddress?.address1 || context.shipping.address,
        trackingNumber: shipment.trackingNumber || undefined,
        viewOrderLink: context.links.order,
        returnWindowDays: RETURN_WINDOW_DAYS,
        startReturnLink: context.links.returns,
        shipmentId: shipment._id.toString(),
      });
    }
  } catch (error) {
    logger.error(`Could not publish ORDER_DELIVERED for ${orderId.toString()}:`, error);
  }
  return true;
}
