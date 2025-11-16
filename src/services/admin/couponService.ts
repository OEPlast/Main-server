import mongoose from 'mongoose';
import Coupon, { CouponType } from '../../models/Coupon';
import { CustomResponseType } from '@/types';

/**
 * Creates a new coupon.
 */
const createCoupon = async ({
  coupon,
  startDate,
  endDate,
  discount,
  active,
  creator,
  couponType,
  allowedUser,
  maxUsage,
  maxUsagePerUser,
  minOrderValue,
  showOnCartPage,
  discountType,
  stackable,
  notes,
}: {
  coupon: string;
  startDate: string;
  endDate: string;
  discount: number;
  active: boolean;
  creator: string;
  couponType?: CouponType['couponType'];
  allowedUser?: string | null;
  maxUsage: number | null;
  maxUsagePerUser: number | null;
  minOrderValue: number | null;
  discountType: 'percentage' | 'fixed';
  stackable: boolean;
  notes: string;
  showOnCartPage: boolean;
}): Promise<CustomResponseType<CouponType>> => {
  try {
    const creatorId = new mongoose.Types.ObjectId(creator);
    const allowedUserId = allowedUser ? new mongoose.Types.ObjectId(allowedUser) : null;

    const newCoupon = new Coupon({
      coupon,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      discount,
      active,
      creator: creatorId,
      discountType,
      stackable,
      showOnCartPage,
      notes,
      ...(couponType ? { couponType } : {}),
      ...(allowedUserId ? { allowedUser: allowedUserId } : {}),
      ...(maxUsage !== null ? { maxUsage } : {}),
      ...(maxUsagePerUser !== null ? { maxUsagePerUser } : {}),
      ...(minOrderValue !== null ? { minOrderValue } : {}),
    });
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
 * Retrieves coupons with pagination + advanced filtering/search/sorting.
 * @param params.page 1-based page number
 * @param params.limit page size (max enforced upstream)
 * @param params.filters optional filters (active, couponType, date range)
 * @param params.search free text search across coupon code & notes
 * @param params.sort comma separated sort fields (e.g. '-createdAt,code')
 */
const getAllCoupons = async (
  page = 1,
  limit = 20,
  params?: {
    filters?: {
      active?: boolean;
      couponType?: CouponType['couponType'];
      startDate?: string;
      endDate?: string;
    };
    search?: string;
    sort?: string; // comma separated fields
  }
): Promise<
  CustomResponseType<{
    items: CouponType[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>
> => {
  try {
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    const appliedFilters: Record<string, unknown> = {};

    if (params?.filters) {
      const { active, couponType, startDate, endDate } = params.filters;
      if (typeof active === 'boolean') {
        query.active = active;
        appliedFilters.active = active;
      }
      if (couponType) {
        query.couponType = couponType;
        appliedFilters.couponType = couponType;
      }
      if (startDate) {
        query.startDate = {
          $gte: new Date(startDate),
        };
      }
      if (endDate) {
        query.endDate = {
          $lte: new Date(endDate),
        };
      }
    }

    // text search (case-insensitive) across coupon code + notes
    if (params?.search) {
      const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ coupon: regex }, { notes: regex }];
    }

    // Sorting
    const appliedSort: Record<string, 1 | -1> = { createdAt: -1 }; // default newest
    if (params?.sort) {
      if (params.sort === '1') {
        appliedSort.createdAt = 1;
      }
    }

    const [items, total] = await Promise.all([
      Coupon.find(query)
        .skip(skip)
        .limit(limit)
        .sort(appliedSort as Record<string, 1 | -1>),
      Coupon.countDocuments(query),
    ]);

    return {
      message: 'Coupons retrieved successfully',
      data: {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
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

/**
 * Retrieves a coupon by ID.
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
 */
const updateCoupon = async (
  id: string,
  updateData: Partial<{
    startDate: string;
    endDate: string;
    discount: number;
    active: boolean;
    deleted: boolean;
    couponType: CouponType['couponType'];
    allowedUser: string | null;
    maxUsage: number | null;
    maxUsagePerUser: number | null;
    minOrderValue: number | null;
    discountType: 'percentage' | 'fixed';
    stackable: boolean;
    appliesTo: { scope: 'order' | 'product' | 'category'; productIds?: string[]; categoryIds?: string[] };
    notes: string;
    showOnCartPage: boolean;
  }>
): Promise<CustomResponseType<CouponType>> => {
  try {
    const payload: Partial<{
      startDate: Date;
      endDate: Date;
      discount: number;
      active: boolean;
      deleted: boolean;
      couponType: CouponType['couponType'];
      allowedUser: mongoose.Types.ObjectId | null;
      maxUsage: number | null;
      maxUsagePerUser: number | null;
      minOrderValue: number | null;
      discountType: 'percentage' | 'fixed';
      stackable: boolean;
      appliesTo: {
        scope: 'order' | 'product' | 'category';
        productIds?: mongoose.Types.ObjectId[];
        categoryIds?: mongoose.Types.ObjectId[];
      };
      notes: string;
      showOnCartPage: boolean;
    }> = {};

    if (updateData.startDate) payload.startDate = new Date(updateData.startDate);
    if (updateData.endDate) payload.endDate = new Date(updateData.endDate);
    if (typeof updateData.discount === 'number') payload.discount = updateData.discount;
    if (typeof updateData.active === 'boolean') payload.active = updateData.active;
    if (typeof updateData.deleted === 'boolean') payload.deleted = updateData.deleted;
    if (updateData.couponType) payload.couponType = updateData.couponType;
    if (typeof updateData.allowedUser !== 'undefined') {
      payload.allowedUser = updateData.allowedUser ? new mongoose.Types.ObjectId(updateData.allowedUser) : null;
    }
    if (typeof updateData.maxUsage !== 'undefined') payload.maxUsage = updateData.maxUsage;
    if (typeof updateData.maxUsagePerUser !== 'undefined') payload.maxUsagePerUser = updateData.maxUsagePerUser;
    if (typeof updateData.minOrderValue !== 'undefined') payload.minOrderValue = updateData.minOrderValue;
    if (updateData.discountType) payload.discountType = updateData.discountType;
    if (typeof updateData.stackable !== 'undefined') payload.stackable = updateData.stackable;
    if (updateData.appliesTo) {
      payload.appliesTo = {
        scope: updateData.appliesTo.scope,
        productIds: updateData.appliesTo.productIds?.map((id) => new mongoose.Types.ObjectId(id)),
        categoryIds: updateData.appliesTo.categoryIds?.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }
    if (typeof updateData.notes === 'string') payload.notes = updateData.notes;
    if (typeof updateData.showOnCartPage === 'boolean') payload.showOnCartPage = updateData.showOnCartPage;

    // prevent timesUsed edits
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timesUsed, ...safePayload } = payload as Record<string, unknown>;

    const coupon = await Coupon.findByIdAndUpdate(id, safePayload, { new: true });
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
 */
const isCouponValid = async (couponCode: string, userId?: string): Promise<CustomResponseType<boolean>> => {
  try {
    const coupon = await Coupon.findOne({ coupon: couponCode, deleted: { $ne: true } });
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
    if (!(currentDate >= startDate && currentDate <= endDate && coupon.active)) {
      return {
        message: 'Coupon is not valid',
        data: false,
        code: 400,
      };
    }

    // Additional validation based on couponType
    if (coupon.couponType === 'one-off') {
      if (coupon.timesUsed && coupon.timesUsed > 0) {
        return { message: 'Coupon already used', data: false, code: 400 };
      }
    }

    if (coupon.couponType === 'one-off-user') {
      if (!userId) {
        return { message: 'User required for this coupon type', data: false, code: 400 };
      }
      const usedBy = (coupon.usedBy as unknown as mongoose.Types.ObjectId[]) || [];
      const alreadyUsed = usedBy.some((u) => u.toString() === userId);
      if (alreadyUsed) {
        return { message: 'Coupon already used by this user', data: false, code: 400 };
      }
    }

    if (coupon.couponType === 'one-off-for-one-person') {
      if (!userId || !coupon.allowedUser) {
        return { message: 'Coupon not allowed for this user', data: false, code: 400 };
      }
      const allowed = coupon.allowedUser.toString() === userId;
      if (!allowed) {
        return { message: 'Coupon not allowed for this user', data: false, code: 403 };
      }
      if (coupon.timesUsed && coupon.timesUsed > 0) {
        return { message: 'Coupon already used', data: false, code: 400 };
      }
    }

    return {
      message: 'Coupon is valid',
      data: true,
      code: 200,
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

const Admin_CouponService = { createCoupon, getCoupon, updateCoupon, deleteCoupon, isCouponValid, getAllCoupons };
export default Admin_CouponService;
