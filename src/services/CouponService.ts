import Coupon from '@/models/Coupon';
import { Types } from 'mongoose';
import { validateCouponCodes } from '@/helpers/couponUtils';
import { priceCart, toCouponLines } from '@/services/pricing';

interface ValidateCouponParams {
  code: string;
  orderTotal: number;
  /** Cart lines; priced on the server. */
  items?: Array<{ product: string; qty: number; selectedAttributes?: Array<{ name: string; value: string }> }>;
  userId?: string;
}

interface CouponValidationResult {
  valid: boolean;
  coupon?: {
    _id: string;
    code: string;
    discount: number;
    discountType: 'percentage' | 'fixed';
    minOrderValue: number;
    appliesTo: {
      scope: string;
      productIds?: string[];
      categoryIds?: string[];
    };
    stackable: boolean;
  };
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  message?: string;
  appliesTo?: {
    scope: string;
    productIds?: string[];
    categoryIds?: string[];
  };
}

class CouponService {
  /**
   * Get all active coupons (public-facing, limited info)
   */
  async getAllPublicCoupons() {
    const now = new Date();
    const coupons = await Coupon.find({
      active: true,
      deleted: false,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [{ maxUsage: null }, { $expr: { $lt: ['$timesUsed', '$maxUsage'] } }],
    })
      .select('coupon discount discountType minOrderValue appliesTo stackable couponType')
      .lean();

    return { code: 200, message: 'Coupons fetched successfully', data: coupons };
  }

  /**
   * Get coupons to display on cart page (showOnCartPage: true)
   */
  async getCartCoupons() {
    const now = new Date();
    const coupons = await Coupon.find({
      active: true,
      deleted: false,
      showOnCartPage: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [{ maxUsage: null }, { $expr: { $lt: ['$timesUsed', '$maxUsage'] } }],
    })
      .select('coupon discount discountType minOrderValue appliesTo stackable couponType endDate')
      .lean();

    return { code: 200, message: 'Coupons retrieved successfully', data: coupons };
  }

  /**
   * Get coupon by code (public info only)
   */
  async getCouponByCode(code: string) {
    const coupon = await Coupon.findOne({
      coupon: code.toUpperCase(),
      deleted: false,
    })
      .select(
        'coupon discount discountType minOrderValue appliesTo stackable couponType active startDate endDate maxUsage timesUsed'
      )
      .lean();

    if (!coupon) {
      return { code: 404, message: 'Coupon not found', data: null };
    }

    return { code: 200, message: 'Coupon retrieved successfully', data: coupon };
  }

  /**
   * Checks a coupon for the storefront's "apply coupon" button and returns the discount it will
   * give. Uses the same eligibility checks and discount formula as checkout validation and order
   * creation (`helpers/couponUtils.validateCouponCodes` → `services/pricing`), so the amount shown
   * here is the amount charged.
   *
   * `items` are priced on the server. Without them (older clients) only `orderTotal` is known, so
   * the coupon is evaluated as if the whole order were one line: product- and category-scoped
   * coupons then report that they don't apply rather than showing a discount checkout won't give.
   */
  async validateCoupon(params: ValidateCouponParams): Promise<CouponValidationResult> {
    const { code, orderTotal, items, userId } = params;

    const lines =
      items && items.length > 0
        ? toCouponLines(
            (
              await priceCart(
                items.map((item) => ({ product: item.product, qty: item.qty, selectedAttributes: item.selectedAttributes }))
              )
            ).lines
          )
        : [{ productId: '', categoryId: null, lineTotal: Math.max(0, Number(orderTotal) || 0) }];

    const result = await validateCouponCodes({ couponCodes: [code], lines, userId: userId ?? null });
    const applied = result.validCoupons[0];
    if (!applied) {
      return { valid: false, message: result.invalidCoupons[0]?.reason ?? 'This coupon cannot be used' };
    }

    const coupon = applied.couponDoc;
    const appliesTo = {
      scope: coupon.appliesTo?.scope ?? 'order',
      productIds: coupon.appliesTo?.productIds?.map((id) => id.toString()),
      categoryIds: coupon.appliesTo?.categoryIds?.map((id) => id.toString()),
    };
    return {
      valid: true,
      coupon: {
        _id: coupon._id.toString(),
        code: coupon.coupon,
        discount: coupon.discount,
        discountType: coupon.discountType,
        minOrderValue: coupon.minOrderValue || 0,
        appliesTo,
        stackable: Boolean(coupon.stackable),
      },
      discount: applied.discount,
      discountType: coupon.discountType,
      message: 'Coupon is valid',
      appliesTo,
    };
  }

  /**
   * Mark coupon as used (called after successful order)
   */
  async useCoupon(code: string, userId?: string) {
    const coupon = await Coupon.findOne({
      coupon: code.toUpperCase(),
      deleted: false,
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    // Increment timesUsed
    coupon.timesUsed += 1;

    // Add user to usedBy if applicable
    if (userId && (coupon.couponType === 'one-off-user' || coupon.couponType === 'one-off-for-one-person')) {
      if (!coupon.usedBy) {
        coupon.usedBy = [];
      }
      coupon.usedBy.push(new Types.ObjectId(userId));
    }

    await coupon.save();

    return coupon;
  }
}

export default new CouponService();
