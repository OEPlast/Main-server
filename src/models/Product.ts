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

// Pack size schema for bulk/wholesale products
// Defines how a product can be sold (e.g., Single, Bag of 10, Carton of 50)
const packSizeSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true, // e.g., "Single", "Bag of 10", "Carton of 50"
    },
    quantity: {
      type: Number,
      required: true,
      min: 1, // how many base units in this pack
    },
    price: {
      type: Number,
      min: 0,
      required: false, // optional — falls back to base product price * quantity
    },
    stock: {
      type: Number,
      min: 0,
      required: false, // optional — falls back to base product stock
    },
    enableAttributes: {
      type: Boolean,
      default: false, // true => allow attribute selection (e.g., color/material)
    },
  },
  { _id: false }
);

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
        miniUrl: { type: String, required: false }, // Minified version URL (optional for backward compatibility)
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
    // GIG Logistics shipping fields (mandatory for all products)
    weight: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    height: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
    },
    width: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
    },
    length: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
    },
    isVolumetric: {
      type: Boolean,
      required: true,
      default: false,
    },
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
    packSizes: {
      type: [packSizeSchema],
      default: undefined, // optional — product may have no pack sizes defined
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    originStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      // This field captures the initial stock value when stock is set/updated
      // Used to calculate sold quantity from sales data
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
