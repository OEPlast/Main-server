import { model, Schema, InferSchemaType } from 'mongoose';

const shipmentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    trackingNumber: { type: String, required: true, unique: true },
    courier: { type: String, required: true },
    status: {
      type: String,
      enum: ['In-Warehouse', 'Shipped', 'Dispatched', 'Delivered', 'Returned', 'Failed'],
      default: 'In-Warehouse',
    },
    estimatedDelivery: { type: Date },
    actualDelivery: { type: Date },
    shippingAddress: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      address1: { type: String, required: true },
      address2: { type: String },
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
