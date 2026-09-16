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

/**
 * Wrong guesses allowed against one code before it is thrown away.
 *
 * A 6-digit code has 900,000 values. With no limit it could simply be brute-forced within its
 * lifetime; with 5 tries per code, and a new code rate-limited, guessing stops being viable.
 */
export const OTP_MAX_ATTEMPTS = 5;

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
    attempts: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: OTP_EXPIRY_MINUTES * 60 },
  },
  {
    timestamps: true,
  }
);

export type OtpType = InferSchemaType<typeof otpSchema>;
const OTP = mongoose.model('otp', otpSchema);

export default OTP;
