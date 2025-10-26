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
          required: false, // Optional - falls back to parent product price if not set
        },
        stock: {
          type: Number,
          required: true,
          default: 0,
          min: 0,
        },
        colorCode: {
          type: String,
          required: false,
          validate: {
            validator: function (v: string | undefined) {
              // Allow valid hex codes like "#FFF" or "#FFFFFF" or empty/undefined
              return !v || /^#([0-9A-F]{3}){1,2}$/i.test(v);
            },
            message: (props: { value?: string }) => `${props.value} is not a valid hex color code!`,
          },
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
