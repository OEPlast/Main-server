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
    // Optional groups can be left unpicked on the product page (e.g. an engraving or colour choice
    // that isn't needed); required ones (the default) start on a value and must keep one.
    optional: {
      type: Boolean,
      default: undefined,
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
        // Gallery shown when this value is selected (e.g. the Rose Gold photos); bare CDN paths.
        images: {
          type: [String],
          default: undefined,
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

// One exact combination of option values (e.g. Metal: Gold + Size: 7) with its own price and
// stock. See `helpers/productVariants.ts` for the rules.
const variantSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    options: {
      type: [new mongoose.Schema({ name: { type: String, required: true }, value: { type: String, required: true } }, { _id: false })],
      required: true,
    },
    price: { type: Number, min: 0, required: false },
    stock: { type: Number, required: true, default: 0, min: 0 },
    sku: { type: String, required: false },
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

    // ── SEO / Google Merchant Center product identity ──────────────────────────
    // Populated via admin UI. GTIN is the strongest Shopping-match signal; brand
    // + mpn are fallbacks. Optional so existing products remain valid.
    brand: {
      type: String,
      trim: true,
    },
    gtin: {
      type: String,
      trim: true,
    },
    mpn: {
      type: String,
      trim: true,
    },
    condition: {
      type: String,
      enum: ['new', 'used', 'refurbished'],
      default: 'new',
    },

    // Denormalized review stats for aggregateRating schema + fast reads.
    // Keep in sync from the review write path.
    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Previous slugs → lets the storefront 301 old URLs to the current one so
    // ranking equity is preserved when a slug changes.
    slugHistory: {
      type: [String],
      default: [],
    },

    description_images: [
      {
        url: { type: String, required: true, default: '' },
        miniUrl: { type: String, required: false },
        cover_image: {
          type: Boolean,
          default: false,
        },
        mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
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
    // Back-in-stock markers (services/catalog/restock.ts; only written when BACK_IN_STOCK_DAYS is set)
    soldOutAt: { type: Date },
    restockedAt: { type: Date },
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
    // Optional add-ons that aren't products (e.g. a tester, free polish); see helpers/productExtras.ts.
    extras: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, required: true, trim: true },
            price: { type: Number, required: true, default: 0, min: 0 },
            description: { type: String, required: false },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    // Price and stock per option combination. When set, `stock` is their sum.
    variants: {
      type: [variantSchema],
      default: undefined,
    },
    // Products offered alongside this one on its page (e.g. a gift box), in order.
    addOns: {
      type: [{ type: ObjectId, ref: 'Product' }],
      default: undefined,
    },
    // Size chart slug (see SizeChart); overrides the category's.
    sizeChart: {
      type: String,
      required: false,
    },
    // Where an imported product came from (e.g. the Vylux scraper). Absent on products created
    // in the admin. Only used to stop the same external product being imported twice.
    source: {
      type: new mongoose.Schema(
        {
          provider: { type: String, required: true },
          externalId: { type: String, required: true },
          importedAt: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
      required: false,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

export type ProductType = InferSchemaType<typeof productSchema>;

// Storefront listings filter on status and sort on one of these; the catalogue query was a
// collection scan sorted in memory before. Category, brand and stock back the category pages,
// brand filter and the low-stock report.
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ status: 1, price: 1 });
productSchema.index({ status: 1, ratingAverage: -1 });
productSchema.index({ status: 1, name: 1 });
productSchema.index({ status: 1, category: 1 });
productSchema.index({ brand: 1 });
// Old-URL redirects look products up by a former slug.
productSchema.index({ slugHistory: 1 });
productSchema.index({ status: 1, stock: 1 });
// One store product per external product. Partial, so products without a source are not indexed.
productSchema.index(
  { 'source.provider': 1, 'source.externalId': 1 },
  { unique: true, partialFilterExpression: { 'source.externalId': { $exists: true } } }
);

const Product = mongoose.model('Product', productSchema);
export default Product;
