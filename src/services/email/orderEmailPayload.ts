import type { HydratedDocument } from 'mongoose';
import Order, { type OrderType } from '@/models/Order';
import GIGConfig from '@/models/GIGConfig';
import {
  orderUrl,
  orderTrackingUrl,
  productReviewUrl,
  returnsUrl,
  shopUrl,
  supportUrl,
  type Brand,
  type DeliveryType,
  type EmailProduct,
  type OrderConfirmationData,
  type PaymentDetails,
  type ShippingInfo,
} from '@rawura/emails';
import { getBrand } from './brand';
import { logger } from '@/lib/logger';

/**
 * Builds the email payload for an order, once.
 *
 * This replaces three divergent hand-rolled copies of the same logic — in
 * `TransactionService.publishOrderSuccessfulEvent`, in the payment-expiry branch of
 * `routes/internal/serviceRoutes`, and in `admin/ShipmentService` — which disagreed about
 * every detail that mattered:
 *
 *  - two of them read `product.description_images[0]` as a string, but the schema stores
 *    `{ url, cover_image }` objects, so their product images resolved to nothing;
 *  - only one of them sent `gigWaybill`, the pickup contact fields, or a delivery estimate;
 *  - one dereferenced `order.shipmentId._id` unguarded, which throws on every pickup order
 *    because `shipmentId` defaults to null;
 *  - one hardcoded a different company's domain into the customer-facing links.
 *
 * Everything an order email needs now comes from here.
 */

/**
 * Named explicitly rather than inferred from `Order.findById`: with the populate chain
 * applied, inference collapses the return type to `{}` and every field access silently
 * becomes an error.
 */
type OrderDocument = HydratedDocument<OrderType>;

/** The subset of an order that every order-scoped email draws on. */
export interface OrderEmailContext {
  brand: Brand;
  email: string;
  firstName?: string;
  lastName?: string;
  orderId: string;
  orderNumber: string;
  purchaseDate: Date;
  deliveryType: DeliveryType;
  gigWaybill?: string;
  products: EmailProduct[];
  payment: PaymentDetails;
  shipping: ShippingInfo;
  links: {
    order: string;
    tracking: string;
    returns: string;
    shop: string;
    support: string;
  };
}

/** Days a customer has to open a return after delivery. Mirrors `returnService`. */
export const RETURN_WINDOW_DAYS = 7;

type PopulatedImage = { url?: string; cover_image?: boolean };

/**
 * Resolves a product's email image.
 *
 * `description_images` is an array of objects. Two of the three original builders indexed it
 * as if it were an array of strings, which is why delivered-order emails shipped with no
 * product imagery at all.
 */
function coverImage(images: unknown): string {
  if (!Array.isArray(images) || images.length === 0) return '';

  const entries = images as Array<PopulatedImage | string>;
  const normalise = (entry: PopulatedImage | string): string =>
    typeof entry === 'string' ? entry : (entry?.url ?? '');

  const cover = entries.find((entry) => typeof entry !== 'string' && entry?.cover_image === true);
  return normalise(cover ?? entries[0]);
}

const POPULATE = [
  { path: 'user', select: 'email firstName lastName' },
  { path: 'products.product', select: 'name slug description_images category price' },
  { path: 'shipmentId', select: 'courier trackingNumber _id' },
];

interface PopulatedUser {
  email: string;
  firstName?: string;
  lastName?: string;
}

interface PopulatedLine {
  product?: {
    name?: string;
    slug?: string;
    description_images?: unknown;
    category?: string;
    price?: number;
  };
  qty?: number;
  price?: number;
  attributes?: Array<{ name: string; value: string }>;
}

/**
 * Loads an order and normalises it into the shape every order email expects.
 * Returns null when the order is missing or has no user to send to.
 */
export async function loadOrderEmailContext(orderId: string): Promise<OrderEmailContext | null> {
  const [order, brand] = await Promise.all([
    Order.findById(orderId).populate(POPULATE) as Promise<OrderDocument | null>,
    getBrand(),
  ]);

  if (!order) {
    logger.warn(`[email] order ${orderId} not found; skipping email`);
    return null;
  }

  const user = order.user as unknown as PopulatedUser | null;
  if (!user?.email) {
    logger.warn(`[email] order ${orderId} has no user email; skipping email`);
    return null;
  }

  const deliveryType = (order.deliveryType ?? 'shipping') as DeliveryType;
  const orderIdString = order._id.toString();

  const products: EmailProduct[] = (order.products as unknown as PopulatedLine[]).map((line) => {
    const unitPrice = line.price ?? line.product?.price ?? 0;
    const quantity = line.qty ?? 0;

    return {
      name: line.product?.name ?? 'Item',
      imagePath: coverImage(line.product?.description_images),
      slug: line.product?.slug,
      category: line.product?.category,
      price: unitPrice,
      quantity,
      subtotal: unitPrice * quantity,
      attributes: line.attributes?.length ? line.attributes : undefined,
      reviewLink: line.product?.slug ? productReviewUrl(brand, line.product.slug) : undefined,
    };
  });

  return {
    brand,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    orderId: orderIdString,
    // Legacy orders predate the field; the raw id is a poor reference but it is at least a
    // real one, and the backfill script removes this case.
    orderNumber: order.orderNumber ?? orderIdString,
    purchaseDate: order.createdAt,
    deliveryType,
    gigWaybill: order.gigWaybill ?? undefined,
    products,
    payment: buildPayment(order),
    shipping: await buildShipping(order, deliveryType),
    links: {
      order: orderUrl(brand, orderIdString),
      tracking: orderTrackingUrl(brand, orderIdString),
      returns: returnsUrl(brand, orderIdString),
      shop: shopUrl(brand),
      support: supportUrl(brand),
    },
  };
}

function buildPayment(order: OrderDocument): PaymentDetails {
  return {
    totalShopping: order.totalBeforeDiscount || order.total || 0,
    shipping: order.shippingPrice || 0,
    tax: order.taxPrice || 0,
    discount: order.couponDiscount || 0,
    subtotal: order.total || 0,
    method: order.paymentMethod || undefined,
    reference: order.paymentResult?.id || undefined,
  };
}

async function buildShipping(order: OrderDocument, deliveryType: DeliveryType): Promise<ShippingInfo> {
  const gigConfig = await GIGConfig.findOne().lean();

  const minDays = typeof gigConfig?.shippingMinDeliveryDays === 'number' ? Math.max(0, gigConfig.shippingMinDeliveryDays) : 2;
  const maxDays = Math.max(
    minDays,
    typeof gigConfig?.shippingMaxDeliveryDays === 'number' ? Math.max(0, gigConfig.shippingMaxDeliveryDays) : 5
  );

  if (deliveryType === 'pickup') {
    const pickupAddress = gigConfig?.senderAddress || process.env.STORE_ADDRESS || 'Store Pickup';
    return {
      courier: 'Pickup',
      address: pickupAddress,
      pickupAddress,
      pickupContactName: gigConfig?.senderName || process.env.STORE_NAME || 'Store Pickup',
      pickupContactPhone: gigConfig?.senderPhoneNumber || process.env.STORE_PHONE || '',
      _id: order.shipmentId?._id?.toString(),
    };
  }

  const shipment = order.shipmentId as unknown as { courier?: string; _id?: { toString(): string } } | null;
  const address = order.shippingAddress;

  return {
    courier: shipment?.courier || (deliveryType === 'gig' ? 'GIG Logistics' : 'Standard Shipping'),
    address: [address?.address1, address?.city, address?.state].filter(Boolean).join(', '),
    deliveryEstimateLabel: `${minDays} - ${maxDays} days`,
    recipientName: [address?.firstName, address?.lastName].filter(Boolean).join(' ') || undefined,
    recipientPhone: address?.phoneNumber || undefined,
    // Optional chained: pickup orders have no shipment, and dereferencing this unguarded is
    // what made the payment-expiry path throw on them.
    _id: shipment?._id?.toString(),
  };
}

/** Payload for the order-confirmation email. */
export function toOrderConfirmation(context: OrderEmailContext): OrderConfirmationData {
  return {
    email: context.email,
    firstName: context.firstName,
    lastName: context.lastName,
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    purchaseDate: context.purchaseDate,
    deliveryType: context.deliveryType,
    gigWaybill: context.gigWaybill,
    products: context.products,
    payment: context.payment,
    shipping: context.shipping,
    orderStatusLink: context.links.order,
  };
}
