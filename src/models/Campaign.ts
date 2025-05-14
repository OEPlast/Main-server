import { model, Schema, InferSchemaType } from 'mongoose';

const campaignSchema = new Schema({
  image: { type: String, required: true },
  title: { type: String, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
});

// Custom validation using pre hook
campaignSchema.pre('validate', function (next) {
  const hasStart = !!this.startDate;
  const hasEnd = !!this.endDate;

  if (hasStart !== hasEnd) {
    return next(new Error('Both startDate and endDate must be provided together or omitted together.'));
  }

  next();
});
export type Icampaign = InferSchemaType<typeof campaignSchema>;

const campaign = model('Campaign', campaignSchema);
export default campaign;
