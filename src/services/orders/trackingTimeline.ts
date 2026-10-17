import mongoose, { Types } from 'mongoose';
import Order from '@/models/Order';
import Shipment from '@/models/Shipment';
import GIGService from '@/services/GIGService';
import { CustomResponseType } from '@/types';

/**
 * A customer-facing view of where an order is: one status (processing / shipped / delivered /
 * cancelled) and a step-by-step timeline built from the order dates and the shipment's history.
 */

export type FulfillmentStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled';

type OrderLike = {
  _id: unknown;
  status?: string | null;
  isPaid?: boolean | null;
  deliveryType?: string | null;
  gigWaybill?: string | null;
  createdAt?: Date;
  paidAt?: Date | null;
  deliveredAt?: Date | null;
  cancelledAt?: Date | null;
  pickupLocation?: { name?: string; city?: string; state?: string } | null;
  gigServiceCentre?: { name?: string; address?: string } | null;
  shippingAddress?: { city?: string; state?: string } | null;
};

type ShipmentLike = {
  status?: string | null;
  courier?: string | null;
  trackingNumber?: string | null;
  estimatedDelivery?: Date | null;
  deliveredOn?: Date | null;
  trackingHistory?: Array<{ location?: string | null; timestamp?: Date | null; description?: string | null }>;
  createdAt?: Date;
};

const SHIPPED = ['Shipped', 'Dispatched', 'In-Transit'];

export function fulfillmentStatusOf(order: OrderLike, shipment?: ShipmentLike | null): FulfillmentStatus {
  if (order.status === 'Cancelled' || order.status === 'Failed') return 'cancelled';
  if (order.deliveredAt || shipment?.status === 'Delivered' || order.status === 'Completed') return 'delivered';
  if ((shipment?.status && SHIPPED.includes(shipment.status)) || (order.deliveryType === 'gig' && order.gigWaybill && order.isPaid)) {
    return 'shipped';
  }
  return 'processing';
}

/** Adds `fulfillmentStatus` to each order (one shipment query for the whole list). */
export async function withFulfillmentStatus<T extends OrderLike>(orders: T[]): Promise<Array<T & { fulfillmentStatus: FulfillmentStatus }>> {
  if (!orders.length) return [];
  const shipments = await Shipment.find({ orderId: { $in: orders.map((o) => o._id) } })
    .select('orderId status')
    .lean();
  const byOrder = new Map(shipments.map((s) => [String(s.orderId), s]));
  return orders.map((o) => ({ ...o, fulfillmentStatus: fulfillmentStatusOf(o, byOrder.get(String(o._id))) }));
}

type Step = { id: string; label: string; date?: string; state: 'done' | 'current' | 'upcoming' };
type Event = { date: string; location: string; description: string };

const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : undefined);

export async function buildTracking(order: OrderLike, shipment: ShipmentLike | null) {
  const status = fulfillmentStatusOf(order, shipment);
  const pickup = order.deliveryType === 'pickup';
  const { data: config } = await GIGService.getPublicCheckoutConfig();
  const placed = order.createdAt ? new Date(order.createdAt) : new Date();

  const carrier = pickup
    ? order.pickupLocation?.name || 'Store pickup'
    : order.deliveryType === 'gig'
      ? order.gigServiceCentre?.name
        ? `GIG Logistics, collect at GIG ${order.gigServiceCentre.name}`
        : 'GIG Logistics'
      : shipment?.courier || 'Standard delivery';
  const trackingNumber = order.gigWaybill || shipment?.trackingNumber || '';
  const estimatedDelivery =
    iso(order.deliveredAt ?? shipment?.deliveredOn) ??
    iso(shipment?.estimatedDelivery) ??
    new Date(placed.getTime() + config.shippingWindow.maxDays * 86_400_000).toISOString();

  // [label, date reached or undefined]
  const history = [...(shipment?.trackingHistory ?? [])].sort(
    (a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime()
  );
  const shippedAt = history[0]?.timestamp ?? (status === 'shipped' || status === 'delivered' ? shipment?.createdAt : undefined);
  const deliveredAt = order.deliveredAt ?? shipment?.deliveredOn ?? undefined;

  let milestones: Array<[string, Date | null | undefined]>;
  if (order.status === 'Cancelled' || order.status === 'Failed') {
    milestones = [
      ['Order placed', placed],
      [order.status === 'Failed' ? 'Payment failed' : 'Cancelled', order.cancelledAt ?? placed],
    ];
  } else if (pickup) {
    milestones = [
      ['Order placed', placed],
      ['Payment confirmed', order.paidAt],
      ['Ready for pickup', status === 'delivered' ? (deliveredAt ?? order.paidAt) : undefined],
      ['Picked up', deliveredAt],
    ];
  } else {
    milestones = [
      ['Order placed', placed],
      ['Payment confirmed', order.paidAt],
      ['Shipped', shippedAt],
      ['Out for delivery', shipment?.status === 'Dispatched' || shipment?.status === 'In-Transit' || deliveredAt ? (history.at(-1)?.timestamp ?? deliveredAt) : undefined],
      ['Delivered', deliveredAt],
    ];
  }
  const lastReached = milestones.reduce((last, [, date], i) => (date ? i : last), 0);
  const finished = status === 'delivered' || status === 'cancelled';
  const steps: Step[] = milestones.map(([label, date], i) => ({
    id: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    date: iso(date ?? undefined),
    state: i < lastReached || (finished && i === lastReached) ? 'done' : i === lastReached ? 'current' : 'upcoming',
  }));

  const destination = pickup
    ? [order.pickupLocation?.city, order.pickupLocation?.state].filter(Boolean).join(', ')
    : [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', ');
  const events: Event[] = [
    ...history.map((h) => ({
      date: iso(h.timestamp ?? undefined) ?? placed.toISOString(),
      location: h.location || destination,
      description: h.description || 'Shipment update',
    })),
    ...steps
      .filter((s) => s.date && !(history.length && (s.id === 'shipped' || s.id === 'out-for-delivery')))
      .map((s) => ({ date: s.date!, location: s.id === 'delivered' || s.id === 'picked-up' ? destination : '', description: s.label })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { carrier, trackingNumber, estimatedDelivery, fulfillmentStatus: status, steps, events };
}

const notFound = { message: 'We could not find an order with that number and email.', data: null, code: 404 };

/** Guest tracking by order number + the email it was placed with. */
export async function trackByNumber(orderNumber: string, email: string): Promise<CustomResponseType<unknown>> {
  const order = await Order.findOne({ orderNumber: orderNumber.trim().toUpperCase() })
    .populate('user', 'email')
    .populate('products.product', 'name slug description_images')
    .lean();
  if (!order) return notFound;
  const accountEmail = (order.user as unknown as { email?: string } | null)?.email?.toLowerCase();
  const guestEmail = order.guestContact?.email?.toLowerCase();
  const wanted = email.trim().toLowerCase();
  if (wanted !== accountEmail && wanted !== guestEmail) return notFound;
  return respond(order as unknown as OrderLike & Record<string, unknown>);
}

/** Tracking for a signed-in customer's own order. */
export async function trackForUser(orderId: string, userId: string): Promise<CustomResponseType<unknown>> {
  if (!mongoose.Types.ObjectId.isValid(orderId)) return { message: 'Order not found', data: null, code: 404 };
  const order = await Order.findOne({ _id: new Types.ObjectId(orderId), user: new Types.ObjectId(userId) })
    .populate('products.product', 'name slug description_images')
    .lean();
  if (!order) return { message: 'Order not found', data: null, code: 404 };
  return respond(order as unknown as OrderLike & Record<string, unknown>);
}

type LineLike = {
  product?: { _id?: unknown; name?: string; slug?: string; description_images?: Array<{ url?: string; cover_image?: boolean }> } | null;
  qty?: number | null;
  price?: number | null;
  attributes?: Array<{ name?: string; value?: string }>;
};

async function respond(order: OrderLike & Record<string, unknown>): Promise<CustomResponseType<unknown>> {
  const shipment = await Shipment.findOne({ orderId: order._id }).lean();
  const tracking = await buildTracking(order, shipment as ShipmentLike | null);
  // Like /orders/lookup: what a customer needs to see, none of the delivery contact details.
  const summary = {
    _id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    isPaid: order.isPaid,
    deliveryType: order.deliveryType,
    createdAt: order.createdAt,
    total: order.total,
    shippingPrice: order.shippingPrice,
    couponDiscount: order.couponDiscount,
    pickupLocation: order.pickupLocation ?? undefined,
    gigServiceCentre: order.gigServiceCentre ?? undefined,
    deliveryArea: order.shippingAddress
      ? { city: order.shippingAddress.city, state: order.shippingAddress.state }
      : undefined,
    items: ((order.products ?? []) as LineLike[]).map((line) => ({
      productId: line.product?._id,
      name: line.product?.name ?? 'Product',
      slug: line.product?.slug,
      image: line.product?.description_images?.find((i) => i.cover_image)?.url ?? line.product?.description_images?.[0]?.url,
      qty: line.qty ?? 0,
      price: line.price ?? 0,
      attributes: (line.attributes ?? []).map((a) => ({ name: a.name, value: a.value })),
    })),
  };
  return { message: 'Tracking retrieved successfully', data: { order: summary, ...tracking }, code: 200 };
}
