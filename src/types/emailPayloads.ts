/**
 * Email payload types used by Main-server.
 *
 * DELIBERATELY DUPLICATED from `@rawura/emails` (v1.0.1 `src/types.ts`) rather than imported
 * from it: the email package must not be responsible for types shared with services. Keep
 * the shapes identical to the package's.
 *
 * Drift is still caught at compile time: every object built against these types is handed to
 * `EmailProcessor.send(kind, data)`, and TypeScript checks it against the package's own
 * parameter type for that kind. A field the package adds, renames or makes required becomes a
 * build error at that call site.
 *
 * NOTE: `EmailUser` deliberately does NOT extend `Record<string, unknown>`. An index signature
 * is what once allowed `data.invoiceNumber` — a field that has never existed on any payload —
 * to compile and ship `Order Confirmation - undefined` to customers. Keep these interfaces
 * closed so a missing field is a build error.
 */

/** Base recipient information carried by every email. */
export interface EmailUser {
  firstName?: string;
  lastName?: string;
  email: string;
}

/** A product line as it appears in an email. */
export interface EmailProduct {
  name: string;
  /** Relative CDN path or absolute URL. Rendered through the `cdnUrl` helper. */
  imagePath: string;
  /** Product slug, used to build storefront/review deep links. */
  slug?: string;
  price?: number;
  discountPrice?: number;
  category?: string;
  quantity?: number;
  subtotal?: number;
  /** Absolute link to the product's review form. Built by the payload builder, never guessed. */
  reviewLink?: string;
  /** Per-item attributes chosen at checkout (e.g. Colour / Blue). */
  attributes?: Array<{ name: string; value: string }>;
}

/** How an order reaches the customer. Drives which shipping block a template renders. */
export type DeliveryType = 'shipping' | 'pickup' | 'gig';

/** Shipping / pickup details. Which fields are populated depends on `deliveryType`. */
export interface ShippingInfo {
  courier: string;
  address: string;
  _id?: string;
  /** e.g. "2 - 5 days". Shipping and GIG only. */
  deliveryEstimateLabel?: string;
  /** Pickup only. */
  pickupContactName?: string;
  pickupContactPhone?: string;
  pickupAddress?: string;
  /** Recipient of the delivery, when it differs from the account holder. */
  recipientName?: string;
  recipientPhone?: string;
}

/** Money breakdown for an order. All values are in the store's base currency (NGN). */
export interface PaymentDetails {
  /** Line-item total before shipping, tax and discount. */
  totalShopping: number;
  shipping: number;
  tax: number;
  discount: number;
  /** The amount actually charged. */
  subtotal: number;
  /** Human label for the payment method, e.g. "Card", "Bank Transfer". */
  method?: string;
  /** Gateway reference, shown so support can match the mail to a transaction. */
  reference?: string;
}

/** Fields shared by every order-scoped email so headers read identically across the set. */
export interface OrderEmailBase extends EmailUser {
  /** Human-readable order reference (e.g. RW-2608-00417). Never the raw Mongo _id. */
  orderNumber: string;
  /** Raw id, used only to build links. */
  orderId: string;
  purchaseDate: Date | string;
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

/** Signup email verification with a one-time code. */
export interface VerificationEmailData extends EmailUser {
  otpCode: string;
  expiresInMinutes: number;
}

/* ------------------------------------------------------------------ */
/* Order lifecycle                                                     */
/* ------------------------------------------------------------------ */

/** Order paid and confirmed. The most detail-heavy email in the set. */
export interface OrderConfirmationData extends OrderEmailBase {
  shipping: ShippingInfo;
  products: EmailProduct[];
  payment: PaymentDetails;
  orderStatusLink: string;
  deliveryType: DeliveryType;
  /** GIG waybill number. Present only when `deliveryType === 'gig'`. */
  gigWaybill?: string;
}

/** Standalone payment receipt for the transaction behind an order. */
export interface PaymentReceiptData extends OrderEmailBase {
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  paidAt: Date | string;
  orderStatusLink: string;
}

/** Payment attempt did not go through. */
export interface PaymentFailedData extends OrderEmailBase {
  amount: number;
  paymentMethod?: string;
  reason?: string;
  retryPaymentLink: string;
  /** Minutes left before the order is released and stock returned. */
  expiresInMinutes?: number;
}

/** Order handed to the courier. */
export interface OrderShippedData extends OrderEmailBase {
  trackingNumber: string;
  orderStatus: string;
  shipping: ShippingInfo;
  products: EmailProduct[];
  manageOrderLink: string;
  trackingLink?: string;
  deliveryType?: DeliveryType;
  gigWaybill?: string;
}

/** Order delivered. */
export interface OrderDeliveredData extends OrderEmailBase {
  products: EmailProduct[];
  viewOrderLink: string;
  deliveredAt: Date | string;
  trackingNumber?: string;
  courierName?: string;
  deliveryAddress?: string;
  /** Deep link to open a return request while the window is still open. */
  returnWindowDays?: number;
  startReturnLink?: string;
}

/** Order cancelled, by the customer or by an admin. */
export interface OrderCancelledData extends OrderEmailBase {
  products: EmailProduct[];
  reason?: string;
  cancelledAt: Date | string;
  /** Set when money had already been captured and is being returned. */
  refundAmount?: number;
  refundEtaDays?: number;
  shopLink: string;
}

/* ------------------------------------------------------------------ */
/* Returns & refunds                                                   */
/* ------------------------------------------------------------------ */

export type ReturnStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'items_received'
  | 'inspecting'
  | 'inspection_passed'
  | 'inspection_failed'
  | 'completed'
  | 'cancelled';

/** Money has actually left the store and is on its way back to the customer. */
export interface OrderRefundedData extends OrderEmailBase {
  returnId: string;
  returnNumber: string;
  returnedProducts: EmailProduct[];
  refundAmount: number;
  refundMethod: string;
  refundReference?: string;
  refundedAt: Date | string;
  /** Business days until the money lands, which depends on the method. */
  refundEtaDays?: number;
  shipping?: ShippingInfo;
  checkRefundLink: string;
}
