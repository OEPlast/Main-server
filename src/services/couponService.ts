import Coupon, { CouponType } from '../models/Coupon';
import { CustomResponseType } from '@/types';
import AnalyticsService from './MainAnalyticsService';

/**
 * Creates a new coupon.
 * @param coupon - The coupon code.
 * @param startDate - The start date of the coupon.
 * @param endDate - The end date of the coupon.
 * @param discount - The discount percentage of the coupon.
 * @param active - The active status of the coupon.
 * @returns A promise that resolves to a custom response containing the created coupon.
 */
const createCoupon = async ({
  coupon,
  startDate,
  endDate,
  discount,
  active,
}: {
  coupon: string;
  startDate: string;
  endDate: string;
  discount: number;
  active: boolean;
}): Promise<CustomResponseType<CouponType>> => {
  try {
    const newCoupon = new Coupon({ coupon, startDate, endDate, discount, active });
    await newCoupon.save();
    return {
      message: 'Coupon created successfully',
      data: newCoupon,
      code: 200,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('11000')) {
        return {
          message: 'Coupon already exists',
          data: null,
          code: 400,
        };
      }
    }
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Retrieves a coupon by ID.
 * @param id - The ID of the coupon to retrieve.
 * @returns A promise that resolves to a custom response containing the coupon.
 */
const getCoupon = async (id: string): Promise<CustomResponseType<CouponType>> => {
  try {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return {
        message: 'Coupon not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Coupon retrieved successfully',
      data: coupon,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates a coupon by ID.
 * @param id - The ID of the coupon to update.
 * @param updateData - The data to update the coupon with.
 * @returns A promise that resolves to a custom response containing the updated coupon.
 */
const updateCoupon = async (
  id: string,
  updateData: Partial<{ coupon: string; startDate: string; endDate: string; discount: number; active: boolean }>
): Promise<CustomResponseType<CouponType>> => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(id, updateData);
    if (!coupon) {
      return {
        message: 'Coupon not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Coupon updated successfully',
      data: coupon,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a coupon by ID.
 * @param id - The ID of the coupon to delete.
 * @returns A promise that resolves to a custom response indicating the result of the deletion.
 */
const deleteCoupon = async (id: string): Promise<CustomResponseType<null>> => {
  try {
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return {
        message: 'Coupon not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Coupon deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Checks if a coupon is valid.
 * @param couponCode - The coupon code to check.
 * @returns A promise that resolves to a custom response indicating if the coupon is valid.
 */
const isCouponValid = async (couponCode: string): Promise<CustomResponseType<boolean>> => {
  try {
    const coupon = await Coupon.findOne({ coupon: couponCode });
    if (!coupon) {
      return {
        message: 'Coupon not found',
        data: false,
        code: 404,
      };
    }
    const currentDate = new Date();
    const startDate = new Date(coupon.startDate);
    const endDate = new Date(coupon.endDate);
    if (currentDate >= startDate && currentDate <= endDate && coupon.active) {
      return {
        message: 'Coupon is valid',
        data: true,
        code: 200,
      };
    }
    return {
      message: 'Coupon is not valid',
      data: false,
      code: 400,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: false,
      code: 500,
    };
  }
};

/**
 * Applies a coupon and returns the discount amount.
 * @param couponCode - The coupon code to apply.
 * @param userId - The ID of the user applying the coupon.
 * @param orderAmount - The total amount of the order before discount.
 * @returns A promise that resolves to a custom response indicating the discount amount.
 */
const applyCoupon = async (
  couponCode: string,
  userId: string,
  orderAmount: number
): Promise<CustomResponseType<{ discount: number; couponId: string }>> => {
  try {
    const coupon = await Coupon.findOne({ coupon: couponCode });
    if (!coupon) {
      return {
        message: 'Coupon not found',
        data: null,
        code: 404,
      };
    }

    // Check if coupon is valid
    const currentDate = new Date();
    const startDate = new Date(coupon.startDate);
    const endDate = new Date(coupon.endDate);

    if (!(currentDate >= startDate && currentDate <= endDate && coupon.active)) {
      return {
        message: 'Coupon is not valid',
        data: null,
        code: 400,
      };
    }

    const discountAmount = (orderAmount * coupon.discount) / 100;

    // Track coupon usage for analytics
    // This runs independently and won't affect the response time
    AnalyticsService.trackCouponUsed(coupon._id.toString(), userId, discountAmount).catch((err) =>
      console.error('Failed to track coupon usage analytics:', err)
    );

    return {
      message: 'Coupon applied successfully',
      data: {
        discount: discountAmount,
        couponId: coupon._id.toString(),
      },
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

export { createCoupon, getCoupon, updateCoupon, deleteCoupon, isCouponValid, applyCoupon };
