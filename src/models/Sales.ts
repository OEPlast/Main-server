import mongoose, { InferSchemaType, HydratedDocument } from 'mongoose';

const variantSchema = new mongoose.Schema({
  attributeName: {
    type: String,
    default: null,
  },
  attributeValue: {
    type: String,
    default: null,
    validate: {
      validator: function (this: { attributeName: string | null }, value: string | null) {
        const bothNull = this.attributeName === null && value === null;
        const bothString = typeof this.attributeName === 'string' && typeof value === 'string';
        return bothNull || bothString;
      },
      message: 'attributeName and attributeValue must both be null or both be strings.',
    },
  },
  discount: { type: Number, default: 10, required: true },
  maxBuys: { type: Number, default: 0 },
  boughtCount: { type: Number, default: 0 },
});
const salesSchema = new mongoose.Schema(
  {
    title: { type: String },
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['Flash', 'Limited', 'Normal'],
      default: 'Normal',
    },
    campaign: {
      type: mongoose.Schema.ObjectId,
      ref: 'Campaign',
    },
    limit: {
      type: Number,
      default: 1,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    variants: [variantSchema],
  },
  { timestamps: true }
);

export type SalesType = InferSchemaType<typeof salesSchema>;
export type SalesDocument = HydratedDocument<SalesType>;
const Sales = mongoose.model<SalesType>('Sales', salesSchema);

export default Sales;
