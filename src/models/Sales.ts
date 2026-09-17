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
  isHot: {
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


// Every checkout line looks up the product's active sale; flash-sale listings range on the dates.
salesSchema.index({ product: 1, isActive: 1, deleted: 1 });
salesSchema.index({ isActive: 1, type: 1, startDate: 1, endDate: 1 });
// `cron/storefrontBoundaries` sweeps for sales that started or ended in the last two minutes; it
// ranges on one date at a time, which the compound index above can't serve for `endDate`.
salesSchema.index({ startDate: 1 });
salesSchema.index({ endDate: 1 });

export default Sales;
