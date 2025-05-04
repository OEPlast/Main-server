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
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
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
    timesUsed: {
      type: Number,
      default: 0,
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
