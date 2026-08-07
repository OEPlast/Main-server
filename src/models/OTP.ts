import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

/**
 * How long a code stays valid, in minutes.
 *
 * Exported so the emails that quote it read the real number: the signup email was hardcoded
 * to promise "10 minutes" against a 6-minute TTL, and the reset email never mentioned an
 * expiry at all.
 */
export const OTP_EXPIRY_MINUTES = 6;

const otpSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['reset password', 'payment', 'create'],
      required: true,
    },
    code: {
      type: Number,
      required: true,
      match: /^\d{6}$/, // Ensures the code is a 6-digit number
    },
    createdAt: { type: Date, default: Date.now, expires: OTP_EXPIRY_MINUTES * 60 },
  },
  {
    timestamps: true,
  }
);

export type OtpType = InferSchemaType<typeof otpSchema>;
const OTP = mongoose.model('otp', otpSchema);

export default OTP;
