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
  },
  {
    timestamps: true,
  }
);

// Set the document to expire 6 minutes after creation
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

export type OtpType = InferSchemaType<typeof otpSchema>;
const OTP = mongoose.model('otp', otpSchema);

export default OTP;
