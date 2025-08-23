import mongoose, { InferSchemaType } from 'mongoose';

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    price: { type: Number, min: 0 },
    etaDays: { type: Number, min: 0 },
  },
  { _id: false }
);

const lgaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    price: { type: Number, min: 0 },
    etaDays: { type: Number, min: 0 },
  },
  { _id: false }
);

const stateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    fallbackPrice: { type: Number, min: 0, default: 0 },
    fallbackEtaDays: { type: Number, min: 0, default: 0 },
    cities: { type: [citySchema], default: [] },
    lgas: { type: [lgaSchema], default: [] },
  },
  { _id: false }
);

const logisticsConfigSchema = new mongoose.Schema({
  countryCode: { type: String, required: true, trim: true, uppercase: true, index: true, unique: true },
  countryName: { type: String, unique: true, default: '', required: true, trim: true, index: true },
  states: { type: [stateSchema], default: [] },
});

export type LogisticsConfigType = InferSchemaType<typeof logisticsConfigSchema>;
const LogisticsConfig = mongoose.model('LogisticsConfig', logisticsConfigSchema);
export default LogisticsConfig;
