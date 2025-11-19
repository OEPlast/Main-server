import { model, Schema, InferSchemaType } from 'mongoose';
import shortUUID from 'short-uuid';

const shipmentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    trackingNumber: { type: String, unique: true }, // Remove 'required: true' - will be auto-generated
    courier: { type: String },
    courierUser: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['In-Warehouse', 'Shipped', 'Dispatched', 'Delivered', 'Returned', 'Failed'],
      default: 'In-Warehouse',
    },
    estimatedDelivery: { type: Date },
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

// Pre-save hook to generate tracking number
shipmentSchema.pre('save', async function (next) {
  if (!this.trackingNumber) {
    const translator = shortUUID();
    // Generate tracking number from MongoDB _id
    this.trackingNumber = translator.fromUUID(this._id.toString()).toUpperCase();
  }
  next();
});

// Indexes for integrity and performance
shipmentSchema.index({ trackingNumber: 1 }, { unique: true });
shipmentSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $exists: true } } });
shipmentSchema.index({ courierUser: 1, status: 1, createdAt: -1 });
shipmentSchema.index({ status: 1, createdAt: -1 });

export type IShipment = InferSchemaType<typeof shipmentSchema>;
const Shipment = model('Shipment', shipmentSchema);
export default Shipment;
