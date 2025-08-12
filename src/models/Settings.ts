import { Schema, model, InferSchemaType } from 'mongoose';
import { Types } from 'mongoose';

const addressSchema = new Schema(
  {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    country: { type: String },
  },
  { _id: false }
);

const settingsSchema = new Schema(
  {
    storeName: { type: String, default: '' },
    companyName: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    websiteUrl: { type: String, default: '' },
    supportEmail: { type: String, default: '' },
    supportPhone: { type: String, default: '' },
    address: { type: addressSchema, default: {} },
    taxId: { type: String, default: '' },
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true }
);

export type SettingsType = InferSchemaType<typeof settingsSchema> & { _id: Types.ObjectId };

const Settings = model('Settings', settingsSchema);
export default Settings;
