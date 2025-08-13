import mongoose, { InferSchemaType } from 'mongoose';

const { ObjectId } = mongoose.Schema;

const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: { type: ObjectId, ref: 'Coupon', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    order: { type: ObjectId, ref: 'Order', required: true },
    amountDiscounted: { type: Number, required: true, min: 0 },
    couponType: { type: String, enum: ['normal', 'one-off', 'one-off-user', 'one-off-for-one-person'], required: true },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ coupon: 1, createdAt: 1 });
// Enforce unique redemption per (user,coupon) for one-off-user coupons only
couponRedemptionSchema.index({ user: 1, coupon: 1 }, { unique: true, partialFilterExpression: { couponType: 'one-off-user' } });
// Enforce single redemption globally for one-off coupons only
couponRedemptionSchema.index({ coupon: 1 }, { unique: true, partialFilterExpression: { couponType: 'one-off' } });

export type CouponRedemptionType = InferSchemaType<typeof couponRedemptionSchema>;
const CouponRedemption = mongoose.model('CouponRedemption', couponRedemptionSchema);
export default CouponRedemption;
