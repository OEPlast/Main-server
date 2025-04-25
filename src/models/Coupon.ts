import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

const couponSchema = new mongoose.Schema(
  {
    coupon: {
      type: String,
      trim: true,
      unique: true,
      uppercase: true,
      required: true,
      minLength: 4,
      maxLength: 12,
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
      default: true,
    },
    couponType: {
      type: String,
      enum: ['one-off', 'one-off-user', 'normal'],
      default: 'normal',
    },
    creator: {
      type: ObjectId,
      required: true,
      ref: 'User',
    },
    deleted: {
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
