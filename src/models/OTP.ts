import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

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
    createdAt: { type: Date, default: Date.now, expires: 60 * 6 },
  },
  {
    timestamps: true,
  }
);

export type OtpType = InferSchemaType<typeof otpSchema>;
const OTP = mongoose.model('otp', otpSchema);

export default OTP;
