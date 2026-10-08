import { Schema, model, InferSchemaType, Types } from 'mongoose';

/** A place customers can collect an order from. With none set up, pickup uses the Settings address. */
const pickupLocationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    hours: { type: String, trim: true }, // e.g. "Mon–Sat, 10am–6pm"
    readyIn: { type: String, trim: true, default: 'Ready in 1–2 business days' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pickupLocationSchema.index({ active: 1, order: 1 });

export type PickupLocationType = InferSchemaType<typeof pickupLocationSchema> & { _id: Types.ObjectId };
const PickupLocation = model('PickupLocation', pickupLocationSchema);
export default PickupLocation;
