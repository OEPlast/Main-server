import mongoose, { InferSchemaType } from 'mongoose';

const { ObjectId } = mongoose.Schema;

const shippingProgressSchema = new mongoose.Schema({
  location: { type: String, required: true },
  date: { type: Date, required: true },
});

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

const orderSchema = new mongoose.Schema(
  {
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
      },
    ],
    shippingAddress: {
      firstName: {
        type: String,
      },
      lastName: {
        type: String,
      },
      phoneNumber: {
        type: String,
      },
      address1: {
        type: String,
      },
      address2: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
      },
      zipCode: {
        type: String,
      },
      country: {
        type: String,
      },
    },
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
      enum: ['shipping', 'pickup'],
      default: 'shipping',
      required: true,
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
    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },
    status: {
      type: String,
      default: 'Pending',
      enum: ['Pending', 'Processing', 'Cancelled', 'Completed'],
    },
    deliveryStatus: {
      type: String,
      default: 'In-Warehouse',
      enum: ['In-Warehouse', 'Shipped', 'Dispatched', 'Delivered', 'Returned'],
    },
    shippingProgress: [shippingProgressSchema],
    paidAt: {
      type: Date,
    },
    deliveredAt: {
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
  },
  {
    timestamps: true,
  }
);

// Added indexes for efficient filtering and searching
orderSchema.index({ createdAt: 1 });
orderSchema.index({ user: 1 });

export type OrderType = InferSchemaType<typeof orderSchema>;
const Order = mongoose.model('Order', orderSchema);

export default Order;
