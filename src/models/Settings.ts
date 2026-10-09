import { Schema, model, InferSchemaType } from 'mongoose';
import { Types } from 'mongoose';
import { DEFAULT_TIMEZONE } from '@/config/timezone';

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

const socialLinksSchema = new Schema(
  {
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    x: { type: String, default: '' },
    threads: { type: String, default: '' },
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
    whatsappNumber: { type: String, default: '' },
    // Free text shown on the contact page, product page and FAQ, e.g. "Mon–Sat, 9am–6pm WAT".
    supportHours: { type: String, default: '' },
    address: { type: addressSchema, default: {} },
    taxId: { type: String, default: '' },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    currency: { type: String, default: 'NGN' },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    socialLinks: { type: socialLinksSchema, default: {} },
    // Storefront catalog: how long a product counts as "new", and how many top sellers get the badge.
    newArrivalDays: { type: Number, default: 30, min: 1, max: 365 },
    bestSellerCount: { type: Number, default: 20, min: 1, max: 200 },
    // Products the store picks to fill the best-seller list while sales are still few (a new
    // store has none). Real best sellers always come first; picks fill the remaining slots.
    bestSellerPicks: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  },
  { timestamps: true }
);

export type SettingsType = InferSchemaType<typeof settingsSchema> & { _id: Types.ObjectId };

const Settings = model('Settings', settingsSchema);
export default Settings;
