/**
 * The one formula for how much a coupon takes off. Used by the storefront's "apply coupon" check,
 * cart validation at checkout, and order creation, so the discount shown is the discount charged.
 *
 * Rules (owner decision, 2026-09-15: "eligible items only"):
 *  - Scope `order`: the whole items subtotal. Scope `product` / `category`: only the lines for
 *    those products or categories. A scoped coupon with an empty list covers the whole order.
 *  - Percentage coupons take that percent of the eligible amount; fixed coupons take their amount,
 *    capped at the eligible amount.
 *  - Several coupons apply in the order given, each on what is left, and the total never exceeds
 *    the items subtotal. A second coupon is only accepted when it and every coupon before it are
 *    marked stackable.
 *
 * Pure: eligibility checks that need the database (dates, usage limits, per-customer rules) live
 * in `helpers/couponUtils.ts`.
 */
import { roundKobo } from './linePricing';

export interface CouponLine {
  productId: string;
  categoryId?: string | null;
  lineTotal: number;
}

export interface PricingCoupon {
  coupon: string;
  discount?: number | null;
  discountType?: 'percentage' | 'fixed' | null;
  stackable?: boolean | null;
  appliesTo?: {
    scope?: 'order' | 'product' | 'category' | null;
    productIds?: unknown[] | null;
    categoryIds?: unknown[] | null;
  } | null;
}

const idSet = (ids?: unknown[] | null): Set<string> => new Set((ids ?? []).map((id) => String(id)));

/** The part of the cart a coupon can discount. */
export function couponEligibleAmount(coupon: PricingCoupon, lines: CouponLine[]): number {
  const scope = coupon.appliesTo?.scope ?? 'order';
  const total = (filter: (line: CouponLine) => boolean) =>
    roundKobo(lines.filter(filter).reduce((sum, line) => sum + line.lineTotal, 0));

  if (scope === 'product') {
    const ids = idSet(coupon.appliesTo?.productIds);
    return ids.size ? total((line) => ids.has(line.productId)) : total(() => true);
  }
  if (scope === 'category') {
    const ids = idSet(coupon.appliesTo?.categoryIds);
    return ids.size ? total((line) => !!line.categoryId && ids.has(line.categoryId)) : total(() => true);
  }
  return total(() => true);
}

/** One coupon's discount, given how much of the subtotal earlier coupons have already used. */
export function computeCouponAmount(coupon: PricingCoupon, lines: CouponLine[], remainingSubtotal: number): number {
  const eligible = Math.min(couponEligibleAmount(coupon, lines), Math.max(0, remainingSubtotal));
  if (eligible <= 0) return 0;
  const value = coupon.discount ?? 0;
  const raw = coupon.discountType === 'fixed' ? Math.min(value, eligible) : (eligible * value) / 100;
  return roundKobo(Math.max(0, Math.min(raw, eligible)));
}

export interface CouponApplication<C extends PricingCoupon> {
  applied: Array<{ coupon: C; discount: number }>;
  rejected: Array<{ coupon: C; reason: string }>;
  totalDiscount: number;
}

/** Applies already-eligible coupons in order. */
export function applyCoupons<C extends PricingCoupon>(coupons: C[], lines: CouponLine[]): CouponApplication<C> {
  const subtotal = roundKobo(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const applied: CouponApplication<C>['applied'] = [];
  const rejected: CouponApplication<C>['rejected'] = [];
  let totalDiscount = 0;

  for (const coupon of coupons) {
    if (applied.length > 0 && (!coupon.stackable || applied.some((a) => !a.coupon.stackable))) {
      rejected.push({ coupon, reason: 'This coupon cannot be combined with another coupon' });
      continue;
    }
    const discount = computeCouponAmount(coupon, lines, subtotal - totalDiscount);
    if (discount <= 0) {
      const scope = coupon.appliesTo?.scope ?? 'order';
      rejected.push({
        coupon,
        reason: scope === 'order' ? 'No discount applicable' : `This coupon does not apply to the ${scope === 'product' ? 'products' : 'categories'} in your cart`,
      });
      continue;
    }
    applied.push({ coupon, discount });
    totalDiscount = roundKobo(totalDiscount + discount);
  }

  return { applied, rejected, totalDiscount: roundKobo(Math.min(totalDiscount, subtotal)) };
}
