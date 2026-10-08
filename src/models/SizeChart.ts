import { Schema, model, InferSchemaType, Types } from 'mongoose';

/** A size guide (ring sizes, chain lengths…). Products and categories point at it by slug. */
const sizeChartSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    // The first column is the size label shown on the product page.
    columns: { type: [String], default: [] },
    rows: { type: [[String]], default: [] },
    howToMeasure: {
      type: [new Schema({ label: { type: String, required: true }, text: { type: String, required: true } }, { _id: false })],
      default: [],
    },
    fitNote: { type: String, default: '' },
  },
  { timestamps: true }
);

export type SizeChartType = InferSchemaType<typeof sizeChartSchema> & { _id: Types.ObjectId };
const SizeChart = model('SizeChart', sizeChartSchema);
export default SizeChart;
