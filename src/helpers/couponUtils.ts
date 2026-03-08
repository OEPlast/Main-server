import mongoose from 'mongoose';
import Coupon from '@/models/Coupon';
import CouponRedemption from '@/models/CouponRedemption';
import type { CouponDoc, PricedItem } from '@/types/order';

export async function validateCouponCodes({
  couponCodes,
  items,
  itemsSubtotal,
  userId,
  session,
}: {
  couponCodes: string[];
  items: PricedItem[];
  itemsSubtotal: number;
  userId: mongoose.Types.ObjectId;
  session: mongoose.ClientSession;
}): Promise<{
  validCoupons: Array<{ code: string; couponDoc: CouponDoc; discount: number }>;
  invalidCoupons: Array<{ code: string; reason: string }>;
  totalDiscount: number;
}> {
  const validCoupons: Array<{ code: string; couponDoc: CouponDoc; discount: number }> = [];
  const invalidCoupons: Array<{ code: string; reason: string }> = [];
  let totalDiscount = 0;

  const now = new Date();
  const userIdStr = userId.toString();

  // Process each coupon code
  for (const code of couponCodes) {
    try {
      // Find coupon by code
      const couponDoc = (await Coupon.findOne({
        coupon: code.toUpperCase(),
        deleted: { $ne: true },
      }).session(session)) as CouponDoc | null;

      if (!couponDoc) {
        invalidCoupons.push({ code, reason: 'Coupon not found' });
        continue;
      }

      // Check if coupon is active
      if (!couponDoc.active) {
        invalidCoupons.push({ code, reason: 'Coupon is inactive' });
        continue;
      }

      // Check date validity
      if (now < couponDoc.startDate || now > couponDoc.endDate) {
        invalidCoupons.push({ code, reason: 'Coupon has expired or not yet active' });
        continue;
      }

      // Check coupon type constraints
      if (couponDoc.couponType === 'one-off-user') {
        const alreadyUsed = await CouponRedemption.countDocuments({
          coupon: couponDoc._id,
          user: userId,
        }).session(session);
        if (alreadyUsed > 0) {
          invalidCoupons.push({ code, reason: 'Coupon already used by this user' });
          continue;
        }
      }

      if (couponDoc.couponType === 'one-off-for-one-person') {
        if (!couponDoc.allowedUser || couponDoc.allowedUser.toString() !== userIdStr) {
          invalidCoupons.push({ code, reason: 'Coupon not allowed for this user' });
          continue;
        }
        const totalRedemptions = await CouponRedemption.countDocuments({
          coupon: couponDoc._id,
        }).session(session);
        if (totalRedemptions >= 1) {
          invalidCoupons.push({ code, reason: 'Coupon already used' });
          continue;
        }
      }

      if (typeof couponDoc.maxUsagePerUser === 'number' && couponDoc.maxUsagePerUser > 0) {
        const userUsageCount = await CouponRedemption.countDocuments({
          coupon: couponDoc._id,
          user: userId,
        }).session(session);
        if (userUsageCount >= couponDoc.maxUsagePerUser) {
          invalidCoupons.push({ code, reason: 'User usage limit reached' });
          continue;
        }
      }
      // Check minimum order value
      if (typeof couponDoc.minOrderValue === 'number' && itemsSubtotal < couponDoc.minOrderValue) {
        invalidCoupons.push({
          code,
          reason: `Minimum order value of ₦${couponDoc.minOrderValue.toLocaleString()} required`,
        });
        continue;
      }

      // Calculate discount for this coupon
      const { discount } = computeCouponDiscount({
        coupon: couponDoc,
        items,
        itemsSubtotal: Math.max(0, itemsSubtotal - totalDiscount), // Apply on remaining amount
      });

      if (discount > 0) {
        const roundedDiscount = Math.round(discount * 100) / 100;
        validCoupons.push({ code, couponDoc, discount: roundedDiscount });
        totalDiscount += roundedDiscount;
      } else {
        invalidCoupons.push({ code, reason: 'No discount applicable' });
      }
    } catch (error) {
      console.error(`Error validating coupon ${code}:`, error);
      invalidCoupons.push({ code, reason: 'Error validating coupon' });
    }
  }

  return { validCoupons, invalidCoupons, totalDiscount: Math.round(totalDiscount * 100) / 100 };
}

export function computeCouponDiscount({
  coupon,
  items,
  itemsSubtotal,
}: {
  coupon: CouponDoc;
  items: PricedItem[];
  itemsSubtotal: number;
}): { discount: number } {
  const type = (coupon.discountType || 'percentage') as 'percentage' | 'fixed';
  const appliesTo = coupon.appliesTo || { scope: 'order' };

  if (type === 'fixed') {
    // Fixed amount on eligible scope
    if (appliesTo.scope === 'order') {
      return { discount: Math.round(Math.min(coupon.discount || 0, itemsSubtotal) * 100) / 100 };
    }
    let eligibleSum = 0;
    if (appliesTo.scope === 'product' && Array.isArray(appliesTo.productIds)) {
      const set = new Set(appliesTo.productIds.map((id) => id.toString()));
      for (const it of items) if (set.has(it.product.toString())) eligibleSum += it.price * it.qty;
    }
    if (appliesTo.scope === 'category' && Array.isArray(appliesTo.categoryIds)) {
      // Requires item categories; fallback to whole order for now
      eligibleSum = itemsSubtotal;
    }
    return { discount: Math.round(Math.min(coupon.discount || 0, eligibleSum) * 100) / 100 };
  } else {
    // percentage
    let base = itemsSubtotal;
    if (appliesTo.scope === 'product' && Array.isArray(appliesTo.productIds)) {
      base = 0;
      const set = new Set(appliesTo.productIds.map((id) => id.toString()));
      for (const it of items) if (set.has(it.product.toString())) base += it.price * it.qty;
    }
    if (appliesTo.scope === 'category' && Array.isArray(appliesTo.categoryIds)) {
      base = itemsSubtotal; // fallback
    }
    const pct = (coupon.discount || 0) / 100;
    return { discount: Math.round(Math.max(0, Math.min(itemsSubtotal, base * pct)) * 100) / 100 };
  }
}
