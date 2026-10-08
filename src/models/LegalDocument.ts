import { Schema, model, InferSchemaType, Types } from 'mongoose';

/** Privacy policy, terms of service, returns and shipping policies, keyed by slug. */
const legalDocumentSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    effectiveDate: { type: Date, required: true },
    intro: { type: String, default: '' },
    sections: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            heading: { type: String, required: true },
            body: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export type LegalDocumentType = InferSchemaType<typeof legalDocumentSchema> & { _id: Types.ObjectId };
const LegalDocument = model('LegalDocument', legalDocumentSchema);
export default LegalDocument;
