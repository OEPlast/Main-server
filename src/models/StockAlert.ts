import { Schema, model, InferSchemaType, Types } from 'mongoose';

/** "Email me when it's back": one waiting request per product, option and address. */
const stockAlertSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    // The selected option, e.g. { name: 'Ring Size', value: '7' }; absent for the whole product.
    attribute: {
      type: new Schema({ name: { type: String, required: true }, value: { type: String, required: true } }, { _id: false }),
      default: undefined,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    // true while waiting; removed once the email has gone out (partial indexes can't match "field absent").
    pending: { type: Boolean, default: true },
    notifiedAt: { type: Date },
  },
  { timestamps: true }
);

// A waiting alert is unique per product/option/email; once notified, the same person can ask again.
stockAlertSchema.index(
  { product: 1, email: 1, 'attribute.name': 1, 'attribute.value': 1 },
  { unique: true, partialFilterExpression: { pending: true } }
);
stockAlertSchema.index({ product: 1, pending: 1 });

export type StockAlertType = InferSchemaType<typeof stockAlertSchema> & { _id: Types.ObjectId };
const StockAlert = model('StockAlert', stockAlertSchema);
export default StockAlert;
