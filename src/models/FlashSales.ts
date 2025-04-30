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
  discount: { type: Number, default: 10 },
  maxBuys: { type: Number, default: 0 },
  boughtCount: { type: Number, default: 0 },
});
const flashSaleSchema = new mongoose.Schema(
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
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    variants: [variantSchema],
  },
  { timestamps: true }
);

export type FlashSaleType = InferSchemaType<typeof flashSaleSchema>;
const FlashSale = mongoose.model('FlashSales', flashSaleSchema);

export default FlashSale;
