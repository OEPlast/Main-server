import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

const specificationSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);
//for wholesale buyinh
const pricingTierSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true, min: 1 },
    maxQty: { type: Number, min: 1, required: false },
    // Pricing strategy: fixedPrice sets unit price, percentOff/amountOff apply discounts on resolved base
    strategy: { type: String, enum: ['fixedPrice', 'percentOff', 'amountOff'], required: true },
    value: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// Ensure maxQty, when provided, is >= minQty
pricingTierSchema.path('maxQty').validate(function (this: { minQty: number }, v: number | undefined) {
  return v == null || v >= this.minQty;
}, 'maxQty must be >= minQty');

const attributeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    children: [
      {
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          min: 0,
        },
        discount: {
          type: Number,
          min: 0,
        },
        stock: {
          type: Number,
          required: true,
          default: 0,
          min: 0,
        },
        image: {
          type: String,
          required: true,
        },
        pricingTiers: {
          type: [pricingTierSchema],
          default: undefined,
        },
      },
    ],
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    category: {
      type: ObjectId,
      required: true,
      ref: 'Category',
    },
    tags: [{ type: String }],

    description_images: [
      {
        url: { type: String, required: true, default: '' },
        cover_image: {
          type: Boolean,
          default: false, //but at least one must be true
        },
      },
    ],
    specifications: [specificationSchema],
    dimension: [
      {
        key: {
          type: String,
          required: true,
          enum: ['length', 'breadth', 'height', 'volume', 'width', 'weight'],
        },
        value: {
          type: String,
          required: true,
        },
      },
    ],
    shipping: {
      addedCost: {
        type: Number,
        default: 0,
        min: 0,
      },
      increaseCostBy: {
        type: Number,
        default: 0,
        min: 0,
      },
      addedDays: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    attributes: [attributeSchema],
    pricingTiers: {
      type: [pricingTierSchema],
      default: undefined,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'inactive',
    },
  },
  {
    timestamps: true,
  }
);

export type ProductType = InferSchemaType<typeof productSchema>;
const Product = mongoose.model('Product', productSchema);
export default Product;
//dimenaions
