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
  discount: { type: Number, default: 0 },
  amountOff: {
    type: Number,
    default: 0,
    validate: {
      validator: function (this: { discount: number }, value: number) {
        const discount = typeof this.discount === 'number' ? this.discount : 0;
        const amountOff = typeof value === 'number' ? value : 0;
        // Exactly one of discount or amountOff must be a positive number
        return discount > 0 !== amountOff > 0;
      },
      message: 'Exactly one of discount or amountOff must be a positive number (not both).',
    },
  },
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
      default: false,
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
