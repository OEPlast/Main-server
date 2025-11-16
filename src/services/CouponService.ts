import Coupon from '@/models/Coupon';
import { Types } from 'mongoose';

interface ValidateCouponParams {
  code: string;
  orderTotal: number;
  productIds?: string[];
  categoryIds?: string[];
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
   * Validate if coupon can be applied to an order
   */
  async validateCoupon(params: ValidateCouponParams): Promise<CouponValidationResult> {
    const { code, orderTotal, productIds = [], categoryIds = [], userId } = params;

    // Find the coupon
    const coupon = await Coupon.findOne({
      coupon: code.toUpperCase(),
      deleted: false,
    });

    if (!coupon) {
      return {
        valid: false,
        message: 'Coupon code not found',
      };
    }

    // Check if coupon is active
    if (!coupon.active) {
      return {
        valid: false,
        message: 'This coupon is currently inactive',
      };
    }

    // Check date validity
    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      return {
        valid: false,
        message: `This coupon is not valid until ${coupon.startDate.toLocaleDateString()}`,
      };
    }

    if (coupon.endDate && now > coupon.endDate) {
      return {
        valid: false,
        message: 'This coupon has expired',
      };
    }

    // Check maximum usage
    if (coupon.maxUsage && coupon.timesUsed >= coupon.maxUsage) {
      return {
        valid: false,
        message: 'This coupon has reached its maximum usage limit',
      };
    }

    // Check minimum order value
    if (coupon.minOrderValue && orderTotal < coupon.minOrderValue) {
      return {
        valid: false,
        message: `Minimum order value of $${coupon.minOrderValue} required`,
      };
    }

    // Check coupon type restrictions
    if (coupon.couponType === 'one-off' && coupon.timesUsed > 0) {
      return {
        valid: false,
        message: 'This coupon can only be used once and has already been redeemed',
      };
    }

    if (coupon.couponType === 'one-off-for-one-person') {
      if (!userId) {
        return {
          valid: false,
          message: 'You must be logged in to use this coupon',
        };
      }
      if (!coupon.allowedUser || coupon.allowedUser.toString() !== userId) {
        return {
          valid: false,
          message: 'This coupon is not available for your account',
        };
      }
      if (coupon.usedBy && coupon.usedBy.some((id) => id.toString() === userId)) {
        return {
          valid: false,
          message: 'You have already used this coupon',
        };
      }
    }

    if (coupon.couponType === 'one-off-user') {
      if (!userId) {
        return {
          valid: false,
          message: 'You must be logged in to use this coupon',
        };
      }
      if (coupon.usedBy && coupon.usedBy.some((id) => id.toString() === userId)) {
        return {
          valid: false,
          message: 'You have already used this coupon',
        };
      }
      if (coupon.maxUsagePerUser && coupon.usedBy) {
        const userUsageCount = coupon.usedBy.filter((id) => id.toString() === userId).length;
        if (userUsageCount >= coupon.maxUsagePerUser) {
          return {
            valid: false,
            message: 'You have reached the maximum usage limit for this coupon',
          };
        }
      }
    }

    // Check appliesTo scope
    if (coupon.appliesTo.scope === 'product' && coupon.appliesTo.productIds?.length) {
      const hasMatchingProduct = productIds.some(
        (pid) => coupon.appliesTo.productIds?.some((cpid) => cpid.toString() === pid)
      );
      if (!hasMatchingProduct) {
        return {
          valid: false,
          message: 'This coupon does not apply to the products in your cart',
        };
      }
    }

    if (coupon.appliesTo.scope === 'category' && coupon.appliesTo.categoryIds?.length) {
      const hasMatchingCategory = categoryIds.some(
        (cid) => coupon.appliesTo.categoryIds?.some((ccid) => ccid.toString() === cid)
      );
      if (!hasMatchingCategory) {
        return {
          valid: false,
          message: 'This coupon does not apply to the categories in your cart',
        };
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (orderTotal * coupon.discount) / 100;
    } else {
      discount = Math.min(coupon.discount, orderTotal);
    }

    return {
      valid: true,
      coupon: {
        _id: coupon._id.toString(),
        code: coupon.coupon,
        discount: coupon.discount,
        discountType: coupon.discountType,
        minOrderValue: coupon.minOrderValue || 0,
        appliesTo: {
          scope: coupon.appliesTo.scope,
          productIds: coupon.appliesTo.productIds?.map((id) => id.toString()),
          categoryIds: coupon.appliesTo.categoryIds?.map((id) => id.toString()),
        },
        stackable: coupon.stackable,
      },
      discount,
      discountType: coupon.discountType,
      message: 'Coupon is valid',
      appliesTo: {
        scope: coupon.appliesTo.scope,
        productIds: coupon.appliesTo.productIds?.map((id) => id.toString()),
        categoryIds: coupon.appliesTo.categoryIds?.map((id) => id.toString()),
      },
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
