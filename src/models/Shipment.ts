import { model, Schema, InferSchemaType } from 'mongoose';

const shipmentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    trackingNumber: { type: String, required: true, unique: true },
    carrier: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'],
      default: 'pending',
    },
    estimatedDelivery: { type: Date },
    actualDelivery: { type: Date },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number },
      weight: { type: Number },
    },
    cost: { type: Number, required: true },
    notes: { type: String },
    trackingHistory: [
      {
        status: { type: String, required: true },
        location: { type: String },
        timestamp: { type: Date, default: Date.now },
        description: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export type IShipment = InferSchemaType<typeof shipmentSchema>;
const Shipment = model('Shipment', shipmentSchema);
export default Shipment;
