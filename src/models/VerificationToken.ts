import mongoose, { InferSchemaType } from 'mongoose';

const verificationTokenSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  expires: {
    type: Date,
    required: true,
  },
});

// Compound unique index for identifier and token
verificationTokenSchema.index({ identifier: 1, token: 1 }, { unique: true });

export type VerificationTokenType = InferSchemaType<typeof verificationTokenSchema>;
const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);

export default VerificationToken;
