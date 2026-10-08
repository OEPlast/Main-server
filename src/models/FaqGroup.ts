import { Schema, model, InferSchemaType, Types } from 'mongoose';

const faqGroupSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    label: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    items: {
      type: [
        new Schema(
          {
            question: { type: String, required: true },
            answer: { type: String, required: true },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export type FaqGroupType = InferSchemaType<typeof faqGroupSchema> & { _id: Types.ObjectId };
const FaqGroup = model('FaqGroup', faqGroupSchema);
export default FaqGroup;
