import { model, Schema, InferSchemaType } from 'mongoose';

const campaignSchema = new Schema(
  {
    image: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'draft' },
    products: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        discount: {
          type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
          value: { type: Number, required: true },
        },
      },
    ],
    sales: [
      {
        saleId: { type: Schema.Types.ObjectId, ref: 'Sales', required: true },
        name: { type: String, required: true },
        discount: { type: Number, required: true },
        type: { type: String, enum: ['flash', 'limited', 'clearance'], required: true },
      },
    ],
    totalProducts: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    averagePrice: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Custom validation using pre hook
campaignSchema.pre('validate', function (next) {
  const hasStart = !!this.startDate;
  const hasEnd = !!this.endDate;

  if (hasStart !== hasEnd) {
    return next(new Error('Both startDate and endDate must be provided together or omitted together.'));
  }

  next();
});

export type ICampaign = InferSchemaType<typeof campaignSchema>;

const Campaign = model('Campaign', campaignSchema);
export default Campaign;
