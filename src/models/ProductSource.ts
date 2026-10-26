import { Schema, model, InferSchemaType, Types } from 'mongoose';

/**
 * Where a product came from (e.g. its Vylux scraper page and the Telegram messages it was built
 * from), for the admin to check and correct the product against. Kept out of the Product
 * document on purpose: storefront queries return whole products, and these links must never
 * reach shoppers. Read and written only through the admin product routes.
 */
const productSourceSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    links: {
      type: [
        new Schema(
          {
            label: { type: String, required: true, trim: true, maxlength: 60 },
            url: { type: String, required: true, trim: true, maxlength: 500 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export type ProductSourceType = InferSchemaType<typeof productSourceSchema> & { _id: Types.ObjectId };
const ProductSource = model('ProductSource', productSourceSchema);
export default ProductSource;
