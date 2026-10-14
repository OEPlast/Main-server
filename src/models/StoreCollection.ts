import { Schema, model, InferSchemaType, Types } from 'mongoose';

/**
 * A storefront collection set up in the admin ("Gifts under ₦50k", "Pearls", "Bridal"). It opens on
 * the product list as `collection=<slug>`, so filters, sorting and paging work inside it.
 *
 * - `manual`: exactly the picked products, in the picked order.
 * - `rules`: every active product matching all the rules that are set (categories, tags,
 *   specifications, price range).
 *
 * `group` decides which menu column it sits in.
 */
const storeCollectionSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 400 },
    image: { type: String, default: '' },
    group: { type: String, enum: ['collections', 'gifting', 'men'], default: 'collections' },
    order: { type: Number, default: 0 },
    showInMenu: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    mode: { type: String, enum: ['manual', 'rules'], default: 'rules' },
    products: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] },
    rules: {
      type: new Schema(
        {
          categories: { type: [{ type: Schema.Types.ObjectId, ref: 'Category' }], default: [] },
          tags: { type: [String], default: [] },
          specs: {
            type: [new Schema({ key: { type: String, required: true }, values: { type: [String], default: [] } }, { _id: false })],
            default: [],
          },
          minPrice: { type: Number, min: 0 },
          maxPrice: { type: Number, min: 0 },
        },
        { _id: false }
      ),
      default: {},
    },
  },
  { timestamps: true }
);

storeCollectionSchema.index({ active: 1, group: 1, order: 1 });

export type StoreCollectionType = InferSchemaType<typeof storeCollectionSchema> & { _id: Types.ObjectId };
const StoreCollection = model('StoreCollection', storeCollectionSchema);
export default StoreCollection;
