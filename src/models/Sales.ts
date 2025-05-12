import mongoose, { InferSchemaType } from 'mongoose';

const variantSchema = new mongoose.Schema({
  attributeName: {
    type: String,
    default: null,
  },
  attributeValue: {
    type: String,
    default: null,
    validate: {
      validator: function (this: any, value: string | null) {
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
      enum: ['Flash', 'Limited', 'Normal', 'Special'],
      default: 'Normal',
    },
    specialCampaign: {
      type: mongoose.Schema.ObjectId,
      ref: 'SpecialCampaign',
      required: function (this: SalesType) {
        return this.type === 'Special';
      },
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
const Sales = mongoose.model('Sales', salesSchema);

export default Sales;
