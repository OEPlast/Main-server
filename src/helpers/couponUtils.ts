import mongoose from 'mongoose';
import Coupon from '@/models/Coupon';
import CouponRedemption from '@/models/CouponRedemption';
import type { CouponDoc } from '@/types/order';
import { applyCoupons, type CouponLine } from '@/services/pricing/couponPricing';

type CouponCheckResult = { ok: true; couponDoc: CouponDoc } | { ok: false; reason: string };

/**
 * Whether one coupon may be used by this customer right now, ignoring the cart contents (dates,
 * usage limits, who it belongs to, minimum spend). The discount itself is worked out afterwards
 * by `applyCoupons`, the formula every checkout step shares.
 */
async function checkCouponEligibility(input: {
  code: string;
  itemsSubtotal: number;
  userId?: mongoose.Types.ObjectId | string | null;
  session?: mongoose.ClientSession;
  now: Date;
}): Promise<CouponCheckResult> {
  const { code, itemsSubtotal, session, now } = input;
  const userId = input.userId ? String(input.userId) : null;

  const query = Coupon.findOne({ coupon: code.toUpperCase(), deleted: { $ne: true } });
  if (session) query.session(session);
  const couponDoc = (await query) as CouponDoc | null;

  if (!couponDoc) return { ok: false, reason: 'Coupon not found' };
  if (!couponDoc.active) return { ok: false, reason: 'Coupon is inactive' };
  if (now < couponDoc.startDate || now > couponDoc.endDate) {
    return { ok: false, reason: 'Coupon has expired or not yet active' };
  }
  if (typeof couponDoc.maxUsage === 'number' && couponDoc.maxUsage > 0 && (couponDoc.timesUsed ?? 0) >= couponDoc.maxUsage) {
    return { ok: false, reason: 'This coupon has reached its usage limit' };
  }
  if (couponDoc.couponType === 'one-off' && (couponDoc.timesUsed ?? 0) > 0) {
    return { ok: false, reason: 'This coupon has already been used' };
  }

  const countRedemptions = (filter: Record<string, unknown>) => {
    const count = CouponRedemption.countDocuments({ coupon: couponDoc._id, ...filter });
    if (session) count.session(session);
    return count;
  };

  if (couponDoc.couponType === 'one-off-user') {
    if (!userId) return { ok: false, reason: 'Sign in to use this coupon' };
    if ((await countRedemptions({ user: userId })) > 0) return { ok: false, reason: 'Coupon already used by this user' };
  }

  if (couponDoc.couponType === 'one-off-for-one-person') {
    if (!userId || !couponDoc.allowedUser || couponDoc.allowedUser.toString() !== userId) {
      return { ok: false, reason: 'Coupon not allowed for this user' };
    }
    if ((await countRedemptions({})) >= 1) return { ok: false, reason: 'Coupon already used' };
  }

  if (typeof couponDoc.maxUsagePerUser === 'number' && couponDoc.maxUsagePerUser > 0 && userId) {
    if ((await countRedemptions({ user: userId })) >= couponDoc.maxUsagePerUser) {
      return { ok: false, reason: 'User usage limit reached' };
    }
  }

  if (typeof couponDoc.minOrderValue === 'number' && itemsSubtotal < couponDoc.minOrderValue) {
    return { ok: false, reason: `Minimum order value of ₦${couponDoc.minOrderValue.toLocaleString('en-NG')} required` };
  }

  return { ok: true, couponDoc };
}

/**
 * Checks each code and works out its discount on `lines` (priced by `services/pricing`). Used by
 * cart validation at checkout and by order creation, so both reach the same amount per coupon.
 */
export async function validateCouponCodes({
  couponCodes,
  lines,
  userId,
  session,
}: {
  couponCodes: string[];
  lines: CouponLine[];
  userId?: mongoose.Types.ObjectId | string | null;
  session?: mongoose.ClientSession;
}): Promise<{
  validCoupons: Array<{ code: string; couponDoc: CouponDoc; discount: number }>;
  invalidCoupons: Array<{ code: string; reason: string }>;
  totalDiscount: number;
}> {
  const now = new Date();
  const itemsSubtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const uniqueCodes = [...new Set(couponCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))];

  const eligible: CouponDoc[] = [];
  const invalidCoupons: Array<{ code: string; reason: string }> = [];

  for (const code of uniqueCodes) {
    try {
      const result = await checkCouponEligibility({ code, itemsSubtotal, userId, session, now });
      if (result.ok) eligible.push(result.couponDoc);
      else invalidCoupons.push({ code, reason: result.reason });
    } catch (error) {
      console.error(`Error validating coupon ${code}:`, error);
      invalidCoupons.push({ code, reason: 'Error validating coupon' });
    }
  }

  const application = applyCoupons(eligible, lines);
  for (const rejected of application.rejected) {
    invalidCoupons.push({ code: rejected.coupon.coupon, reason: rejected.reason });
  }

  return {
    validCoupons: application.applied.map((a) => ({ code: a.coupon.coupon, couponDoc: a.coupon, discount: a.discount })),
    invalidCoupons,
    totalDiscount: application.totalDiscount,
  };
}
