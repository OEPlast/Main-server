import { Schema, model, InferSchemaType, Types } from 'mongoose';

const DELIVERY_METHODS = ['shipping', 'pickup', 'gig'] as const;

const gigConfigSchema = new Schema(
  {
    // Sender / Store details for GIG shipments
    senderName: { type: String, required: true },
    senderPhoneNumber: { type: String, required: true },
    senderAddress: { type: String, required: true },
    senderLocality: { type: String, default: '' },
    senderStationId: { type: Number, required: true },
    senderLatitude: { type: Number, default: 0 },
    senderLongitude: { type: Number, default: 0 },
    senderCountryCode: { type: String, default: 'NG' },

    // GIG account details
    customerCode: { type: String, required: true },
    customerType: { type: String, default: '' },

    // Default shipment options
    vehicleType: { type: String, default: 'BIKE' },
    defaultDeliveryOptionIds: { type: [Number], default: [] },
    defaultPickUpOptions: { type: String, default: '' },

    // Checkout delivery controls
    enabledDeliveryMethods: {
      type: [String],
      enum: DELIVERY_METHODS,
      default: ['shipping', 'pickup', 'gig'],
    },
    shippingDiscountAmountOff: { type: Number, default: 0, min: 0, max: 100 },
    gigDiscountAmountOff: { type: Number, default: 0, min: 0, max: 100 },
    freeShippingThreshold: { type: Number, default: null, min: 0 },
    shippingMinDeliveryDays: { type: Number, default: 2, min: 0 },
    shippingMaxDeliveryDays: { type: Number, default: 5, min: 0 },

    // Feature flag
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type GIGConfigType = InferSchemaType<typeof gigConfigSchema> & { _id: Types.ObjectId };

const GIGConfig = model('GIGConfig', gigConfigSchema);
export default GIGConfig;
