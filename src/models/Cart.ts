import mongoose, { InferSchemaType } from 'mongoose';

const { ObjectId } = mongoose.Schema;

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: ObjectId,
      ref: 'Product',
      required: true,
    },
    qty: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      max: [9999, 'Quantity cannot exceed 99'],
    },
    // Store snapshot of product data at time of adding to cart
    productSnapshot: {
      name: String,
      price: Number,
      sku: Number,
    },
    // Selected product attributes (e.g., size: Large, color: Red)
    selectedAttributes: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        value: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    // Pricing information
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative'],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative'],
    },
    // Sales information
    sale: {
      type: ObjectId,
      ref: 'Sales',
    },
    saleVariantIndex: {
      type: Number,
      min: 0,
    },
    appliedDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative'],
    },
    // Pricing tier information for wholesale
    pricingTier: {
      minQty: Number,
      maxQty: Number,
      strategy: String,
      value: Number,
      appliedPrice: Number,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Enforce one cart per user
    },
    items: [cartItemSchema],
    // Cart-level totals
    subtotal: {
      type: Number,
      default: 0,
      min: [0, 'Subtotal cannot be negative'],
    },
    totalDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Total discount cannot be negative'],
    },
    total: {
      type: Number,
      default: 0,
      min: [0, 'Total cannot be negative'],
    },
    // Applied coupons
    appliedCoupons: [
      {
        coupon: {
          type: ObjectId,
          ref: 'Coupon',
          required: true,
        },
        code: {
          type: String,
          required: true,
        },
        discountAmount: {
          type: Number,
          required: true,
          min: [0, 'Discount amount cannot be negative'],
        },
        appliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Cart status
    status: {
      type: String,
      enum: ['active', 'abandoned', 'converted'],
      default: 'active',
    },
    // Shipping information
    estimatedShipping: {
      cost: {
        type: Number,
        default: 0,
        min: [0, 'Shipping cost cannot be negative'],
      },
      days: {
        type: Number,
        default: 0,
        min: [0, 'Shipping days cannot be negative'],
      },
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24, // TTL index: 24 hours (1 day)
    },
  },
  {
    timestamps: true,
  }
);

// Update lastActivity on any cart modification to extend TTL
cartSchema.pre('save', function (next) {
  if (this.isModified('items')) {
    this.lastActivity = new Date();
  }
  next();
});

cartSchema.pre(['findOneAndUpdate', 'updateOne'], function (next) {
  this.set({ lastActivity: new Date() });
  next();
});

export type CartType = InferSchemaType<typeof cartSchema>;
const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
