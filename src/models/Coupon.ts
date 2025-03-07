import mongoose, { InferSchemaType } from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    coupon: {
      type: String,
      trim: true,
      unique: true,
      uppercase: true,
      required: true,
      minLength: 4,
      maxLength: 10,
    },
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: true,
    },
    discount: {
      type: Number,
      required: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export type CouponType = InferSchemaType<typeof couponSchema>;
const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
