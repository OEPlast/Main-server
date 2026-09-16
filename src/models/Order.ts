import mongoose, { InferSchemaType } from 'mongoose';
import { generateOrderNumber } from '@/utils/orderNumber';

const { ObjectId } = mongoose.Schema;

const couponSnapshotSchema = new mongoose.Schema(
  {
    discount: { type: Number },
    discountType: { type: String, enum: ['percentage', 'fixed'] },
    appliesTo: {
      scope: { type: String, enum: ['order', 'product', 'category'] },
      productIds: [{ type: ObjectId, ref: 'Product' }],
      categoryIds: [{ type: ObjectId, ref: 'Category' }],
    },
  },
  { _id: false }
);

/**
 * Shared by `shippingAddress` and `billingAddress` so the two can never drift.
 *
 * Every field is optional: a pickup order has no shipping address at all, and a billing
 * address is absent whenever it simply mirrors shipping (see `billingSameAsShipping`).
 *
 * `latitude`/`longitude` are supplied by the storefront's geocoding step for GIG deliveries.
 * They were previously accepted at checkout and then dropped on save, so the coordinates the
 * courier quote was based on were lost the moment the order was written.
 */
const addressSchema = new mongoose.Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    phoneNumber: { type: String },
    address1: { type: String },
    address2: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
    lga: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { _id: false }
);

/**
 * Who to contact about a guest order, as typed at checkout. A signed-in customer's details live
 * on their account; a guest's user record is created from these same values, but a pickup order
 * has no shipping address, so without this snapshot the order carries no phone number at all.
 * Absent on orders placed while signed in.
 */
const guestContactSchema = new mongoose.Schema(
  {
    email: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    phoneNumber: { type: String },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Human-readable reference (e.g. RW-2608-00417) quoted in emails, the admin panel and by
    // support. Assigned by the pre-save hook below; `sparse` so the unique index tolerates
    // historical orders until the backfill script has run over them.
    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    products: [
      {
        product: {
          type: ObjectId,
          ref: 'Product',
        },
        qty: {
          type: Number,
        },
        price: {
          type: Number,
        },
        attributes: [
          {
            name: {
              type: String,
              required: true,
            },
            value: {
              type: String,
              required: true,
            },
          },
        ],
        // Sale info fields
        sale: {
          type: ObjectId,
          ref: 'Sales',
        },
        saleType: {
          type: String,
          enum: ['Flash', 'Limited', 'Normal'],
        },
        saleVariantIndex: {
          type: Number,
        },
        saleDiscount: {
          type: Number,
        },
        // Sale snapshot for reversal on cancellation
        saleSnapshot: {
          type: {
            type: String,
            enum: ['Flash', 'Limited', 'Normal'],
          },
          variantIndex: Number,
          maxBuys: Number,
          boughtCount: Number,
          attributeName: String,
          attributeValue: String,
        },
      },
    ],
    shippingAddress: { type: addressSchema },
    /**
     * Where the customer is billed, when that differs from where the order ships.
     *
     * Read alongside `billingSameAsShipping`: this field being absent is ambiguous on its own
     * (it means "mirrors shipping" on a new order, but "never captured" on one placed before
     * billing addresses existed), which is what the boolean disambiguates.
     */
    billingAddress: { type: addressSchema, default: undefined },
    billingSameAsShipping: {
      type: Boolean,
      default: true,
    },
    guestContact: { type: guestContactSchema, default: undefined },
    paymentMethod: {
      type: String,
    },
    paymentResult: {
      id: String,
      status: String,
      email: String,
    },
    total: {
      type: Number,
      required: true,
    },
    totalBeforeDiscount: {
      type: Number,
    },
    couponApplied: {
      type: String,
    },
    coupon: { type: ObjectId, ref: 'Coupon' },
    couponCode: { type: String },
    couponDiscount: { type: Number, default: 0 },
    couponSnapshot: { type: couponSnapshotSchema, default: undefined },
    // Delivery options
    deliveryType: {
      type: String,
      enum: ['shipping', 'pickup', 'gig'],
      default: 'shipping',
      required: true,
    },
    gigWaybill: {
      type: String,
      default: null,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    taxPrice: {
      type: Number,
      default: 0,
    },
    transactionId: {
      type: ObjectId,
      ref: 'Transaction',
      default: null,
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },
    status: {
      type: String,
      default: 'Pending',
      enum: ['Pending', 'Processing', 'Cancelled', 'Completed', 'Failed'],
    },
    shipmentId: {
      type: ObjectId,
      ref: 'Shipment',
      default: null,
    },
    // Event timestamps. Analytics buckets by WHEN AN EVENT HAPPENED, so every
    // measurable transition records its own time here. `updatedAt` cannot serve
    // this purpose — it only ever holds the most recent mutation, so an order
    // cancelled in March and edited in June looks like a June cancellation.
    // Written via `orderStatusUpdate()` (utils/orderStatusTimestamps) so a new
    // transition site cannot silently forget one.
    paidAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    // Stamped when this order's stock, sale allocation and coupon usage are handed back. Set in
    // the same atomic update that performs the release, so every path that frees an order (payment
    // failure, expiry, customer or admin cancel) can run without ever restoring stock twice.
    inventoryReleasedAt: {
      type: Date,
    },
    // When the post-delivery review request went out (or was skipped because every item was
    // already reviewed). Set once by cron/reviewRequests, so a customer is asked at most once.
    reviewRequestSentAt: {
      type: Date,
    },
    flashSaleApplied: [
      {
        flashSale: {
          type: mongoose.Schema.ObjectId,
          required: true,
          ref: 'Sales',
        },
        product: {
          type: mongoose.Schema.ObjectId,
          required: true,
          ref: 'Product',
        },
        attributeName: {
          type: String,
          default: null,
        },
        attributeValue: {
          type: String,
          default: null,
        },
        discount: {
          type: Number,
          required: true,
        },
      },
    ],
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Added indexes for efficient filtering and searching
orderSchema.index({ createdAt: 1 });
orderSchema.index({ user: 1 });
// Admin list (status + newest first), a customer's order history, the payment reconciliation
// job's scan of expired unpaid orders, the GIG tracking job, and the transaction/shipment joins.
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ isPaid: 1, status: 1, createdAt: 1 });
orderSchema.index({ deliveryType: 1, status: 1 });
orderSchema.index({ transactionId: 1 }, { sparse: true });
orderSchema.index({ shipmentId: 1 }, { sparse: true });

// Event-timestamp indexes. The analytics engine ranges on whichever of these a
// metric is measured on — revenue on `paidAt`, cancellations on `cancelledAt` —
// so without these every metric except `orders_placed` falls back to a collection
// scan. Sparse because most orders never reach most of these states, and a sparse
// index also skips exactly the documents the range match would exclude anyway.
orderSchema.index({ paidAt: 1 }, { sparse: true });
orderSchema.index({ deliveredAt: 1 }, { sparse: true });
orderSchema.index({ cancelledAt: 1 }, { sparse: true });
orderSchema.index({ completedAt: 1 }, { sparse: true });
orderSchema.index({ failedAt: 1 }, { sparse: true });
orderSchema.index({ refundedAt: 1 }, { sparse: true });

/**
 * Assign the human-readable reference before the first save.
 *
 * Done in a hook rather than at the (single, transactional) creation site so that any future
 * creation path gets a number automatically — an order without one falls back to showing a
 * raw ObjectId to the customer.
 */
orderSchema.pre('save', async function assignOrderNumber(next) {
  if (this.orderNumber) return next();

  try {
    this.orderNumber = await generateOrderNumber(this.get('createdAt') ?? new Date());
    next();
  } catch (error) {
    next(error as Error);
  }
});

export type OrderType = InferSchemaType<typeof orderSchema>;
const Order = mongoose.model('Order', orderSchema);

export default Order;
