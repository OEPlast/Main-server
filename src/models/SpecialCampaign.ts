import { model, Schema, InferSchemaType } from 'mongoose';

const specialCampaignSchema = new Schema({
  image: { type: String, required: true },
  title: { type: String, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
});

// Custom validation using pre hook
specialCampaignSchema.pre('validate', function (next) {
  const hasStart = !!this.startDate;
  const hasEnd = !!this.endDate;

  if (hasStart !== hasEnd) {
    return next(new Error('Both startDate and endDate must be provided together or omitted together.'));
  }

  next();
});
export type ISpecialCampaign = InferSchemaType<typeof specialCampaignSchema>;

const SpecialCampaign = model('SpecialCampaign', specialCampaignSchema);
export default SpecialCampaign;
