import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

/*
It allows a coupon to be targeted to a specific order, a set of products, or a set of categories.
{ scope: 'product', productIds: [ObjectId('...'), ObjectId('...')] }
→ Coupon only applies if the cart contains those products.
{ scope: 'category', categoryIds: [ObjectId('...')] }
→ Coupon only applies to products in that category.
{ scope: 'order' }
→ Coupon applies to the whole order, regardless of products/categories.
*/
const appliesToSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ['order', 'product', 'category'],
      default: 'order',
    },
    productIds: [{ type: ObjectId, ref: 'Product' }],
    categoryIds: [{ type: ObjectId, ref: 'Category' }],
  },
  { _id: false }
);

const couponSchema = new mongoose.Schema(
  {
    coupon: {
      type: String,
      trim: true,
      unique: true,
      uppercase: true,
      required: true,
      minLength: 4,
      maxLength: 20,
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
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    appliesTo: {
      type: appliesToSchema,
      default: { scope: 'order' },
    },
    stackable: {
      //allow if coupon can be used with other coupons or not
      type: Boolean,
      default: false,
    },
    showOnCartPage: {
      // Whether to display this coupon on the cart page for customers to see
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    timesUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUsage: {
      type: Number,
      default: null,
    },
    maxUsagePerUser: {
      type: Number,
      default: null,
    },
    couponType: {
      type: String,
      enum: ['one-off', 'one-off-user', 'one-off-for-one-person', 'normal'],
      default: 'normal',
    },
    // When couponType is 'one-off-for-one-person', only this user can redeem it once
    allowedUser: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },
    // Track users who have redeemed the coupon (used for 'one-off-user')
    usedBy: [
      {
        type: ObjectId,
        ref: 'User',
      },
    ],
    notes: {
      type: String,
      default: undefined,
      trim: true,
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

couponSchema.index({ active: 1, startDate: 1, endDate: 1 });

export type CouponType = InferSchemaType<typeof couponSchema>;
const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
