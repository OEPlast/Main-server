import { model, Schema, InferSchemaType } from 'mongoose';

const shipmentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    trackingNumber: { type: String, required: true, unique: true },
    courier: { type: String},
    courierUser: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['In-Warehouse', 'Shipped', 'Dispatched', 'Delivered', 'Returned', 'Failed'],
      default: 'In-Warehouse',
    },
    estimatedDelivery: { type: Date },
    // actualDelivery: { type: Date }, changed to deliveredOn
    deliveredOn: { type: Date },
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

// Indexes for integrity and performance
// Unique tracking number already defined at field level, keep an explicit index for clarity
shipmentSchema.index({ trackingNumber: 1 }, { unique: true });
// Ensure one shipment per order (if orderId exists)
shipmentSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $exists: true } } });
// Performance indexes for courier assignments and status filtering
shipmentSchema.index({ courierUser: 1, status: 1, createdAt: -1 });
shipmentSchema.index({ status: 1, createdAt: -1 });

export type IShipment = InferSchemaType<typeof shipmentSchema>;
const Shipment = model('Shipment', shipmentSchema);
export default Shipment;
