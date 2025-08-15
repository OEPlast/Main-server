import mongoose from 'mongoose';
import CouponRedemption from '@/models/CouponRedemption';
import { CustomResponseType } from '@/types';

const getCouponSummary = async (
  couponId: string
): Promise<CustomResponseType<{ totalRedemptions: number; totalDiscount: number; uniqueUsers: number }>> => {
  try {
    const couponObjId = new mongoose.Types.ObjectId(couponId);
    const [agg] = await CouponRedemption.aggregate([
      { $match: { coupon: couponObjId } },
      {
        $group: {
          _id: null,
          totalRedemptions: { $sum: 1 },
          totalDiscount: { $sum: '$amountDiscounted' },
          users: { $addToSet: '$user' },
        },
      },
      {
        $project: {
          _id: 0,
          totalRedemptions: 1,
          totalDiscount: 1,
          uniqueUsers: { $size: '$users' },
        },
      },
    ]);
    return {
      message: 'Summary retrieved',
      data: agg || { totalRedemptions: 0, totalDiscount: 0, uniqueUsers: 0 },
      code: 200,
    };
  } catch (e) {
    return { message: 'Failed to get summary', data: null, code: 500 };
  }
};

const getUsageByDay = async (couponId: string): Promise<CustomResponseType<Array<{ date: string; count: number }>>> => {
  try {
    const couponObjId = new mongoose.Types.ObjectId(couponId);
    const results = await CouponRedemption.aggregate([
      { $match: { coupon: couponObjId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } },
    ]);
    return { message: 'Usage by day retrieved', data: results, code: 200 };
  } catch (e) {
    return { message: 'Failed to get usage by day', data: null, code: 500 };
  }
};

const getTopCoupons = async (
  limit = 10
): Promise<CustomResponseType<Array<{ couponId: string; redemptions: number; totalDiscount: number }>>> => {
  try {
    const results = await CouponRedemption.aggregate([
      {
        $group: {
          _id: '$coupon',
          redemptions: { $sum: 1 },
          totalDiscount: { $sum: '$amountDiscounted' },
        },
      },
      { $sort: { redemptions: -1 } },
      { $limit: limit },
      { $project: { _id: 0, couponId: '$_id', redemptions: 1, totalDiscount: 1 } },
    ]);
    return { message: 'Top coupons retrieved', data: results, code: 200 };
  } catch (e) {
    return { message: 'Failed to get top coupons', data: null, code: 500 };
  }
};

const getCouponUsers = async (
  couponId: string
): Promise<CustomResponseType<Array<{ userId: string; times: number }>>> => {
  try {
    const couponObjId = new mongoose.Types.ObjectId(couponId);
    const results = await CouponRedemption.aggregate([
      { $match: { coupon: couponObjId } },
      { $group: { _id: '$user', times: { $sum: 1 } } },
      { $project: { _id: 0, userId: '$_id', times: 1 } },
      { $sort: { times: -1 } },
    ]);
    return { message: 'Coupon users retrieved', data: results, code: 200 };
  } catch (e) {
    return { message: 'Failed to get coupon users', data: null, code: 500 };
  }
};

const CouponAnalyticsService = { getCouponSummary, getUsageByDay, getTopCoupons, getCouponUsers };
export default CouponAnalyticsService;
