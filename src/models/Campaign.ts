import { model, Schema, InferSchemaType } from 'mongoose';

const campaignSchema = new Schema(
  {
    image: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'draft' },
    products: [{ type: Schema.Types.ObjectId, ref: 'Product', required: true }],
    sales: [{ type: Schema.Types.ObjectId, ref: 'Sales', required: true }],
  },
  { timestamps: true }
);

// Custom validation using pre hook
campaignSchema.pre('validate', function (next) {
  const hasStart = !!this.startDate;
  const hasEnd = !!this.endDate;
  const productsLength = this.products?.length;
  const salesLength = this.sales?.length;
  if (hasStart !== hasEnd) {
    return next(new Error('Both startDate and endDate must be provided together or omitted together.'));
  }
  if ((productsLength || 0) === 0 && (salesLength || 0) === 0) {
    return next(new Error('At least one product or one sale is required.'));
  }

  next();
});

export type ICampaign = InferSchemaType<typeof campaignSchema>;

const Campaign = model('Campaign', campaignSchema);
export default Campaign;
