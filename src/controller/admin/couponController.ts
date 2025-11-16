import { Request, Response } from 'express';
import { AuthenticatedRequest, isAuthenticatedRequest } from '../../types';
import CouponService from '../../services/admin/couponService';

// Get all coupons (paginated + filters/search/sort)
const getCoupons = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const active = typeof req.query.active !== 'undefined' ? req.query.active === 'true' : undefined;
    const couponType = typeof req.query.couponType === 'string' ? (req.query.couponType as string) : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : undefined;
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

    // narrow couponType to allowed values
    const allowedTypes = ['one-off', 'one-off-user', 'one-off-for-one-person', 'normal'] as const;
    const isCouponType = (val: string): val is (typeof allowedTypes)[number] =>
      (allowedTypes as readonly string[]).includes(val);
    const narrowedCouponType = couponType && isCouponType(couponType) ? couponType : undefined;

    const { message, data, code } = await CouponService.getAllCoupons(page, limit, {
      filters: { active, couponType: narrowedCouponType, startDate, endDate },
      search,
      sort,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCoupons:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
// Get one coupon
const getCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, data, code } = await CouponService.getCoupon(id);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCoupons:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new coupon
const createCoupon = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const user = (req as AuthenticatedRequest).userId;
    const {
      startDate,
      endDate,
      coupon,
      discount,
      active,
      couponType,
      allowedUser,
      maxUsage,
      maxUsagePerUser,
      minOrderValue,
      discountType,
      stackable,
      notes,
      showOnCartPage,
    } = req.body as {
      coupon: string;
      startDate: string;
      endDate: string;
      discount: number | string;
      active: boolean;
      couponType?: 'one-off' | 'one-off-user' | 'one-off-for-one-person' | 'normal';
      allowedUser?: string | null;
      maxUsage: number | null;
      maxUsagePerUser: number | null;
      minOrderValue: number | null;
      discountType: 'percentage' | 'fixed';
      stackable: boolean;
      showOnCartPage: boolean;
      notes: string;
    };

    const mainData = {
      startDate,
      endDate,
      discount: Number(discount),
      active,
      creator: user!,
      coupon,
      couponType,
      allowedUser,
      maxUsage,
      maxUsagePerUser,
      minOrderValue,
      discountType,
      stackable,
      notes,
      showOnCartPage,
    };

    const { message, data, code } = await CouponService.createCoupon(mainData);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in createCoupon:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a coupon
const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      discount,
      active,
      couponType,
      deleted,
      allowedUser,
      maxUsage,
      maxUsagePerUser,
      minOrderValue,
      discountType,
      stackable,
      appliesTo,
      notes,
      showOnCartPage,
    } = req.body as {
      startDate?: string;
      endDate?: string;
      discount?: number | string;
      active?: boolean;
      couponType?: 'one-off' | 'one-off-user' | 'one-off-for-one-person' | 'normal';
      deleted?: boolean;
      allowedUser?: string | null;
      maxUsage?: number | null;
      maxUsagePerUser?: number | null;
      minOrderValue?: number | null;
      discountType?: 'percentage' | 'fixed';
      stackable?: boolean;
      appliesTo?: { scope: 'order' | 'product' | 'category'; productIds?: string[]; categoryIds?: string[] };
      notes?: string;
      showOnCartPage: boolean;
    };

    const updateData = {
      startDate,
      endDate,
      discount: typeof discount !== 'undefined' ? Number(discount) : undefined,
      active,
      couponType,
      deleted,
      allowedUser,
      maxUsage,
      maxUsagePerUser,
      minOrderValue,
      discountType,
      stackable,
      appliesTo,
      notes,
      showOnCartPage,
    };
    // Ensure timesUsed cannot be altered
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timesUsed, ...safeUpdate } = updateData as Record<string, unknown>;

    const { message, data, code } = await CouponService.updateCoupon(
      id,
      safeUpdate as Partial<{
        startDate: string;
        endDate: string;
        discount: number;
        active: boolean;
        deleted: boolean;
        couponType: 'one-off' | 'one-off-user' | 'one-off-for-one-person' | 'normal';
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
    );
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateCoupon:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a coupon
const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, data, code } = await CouponService.deleteCoupon(id);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in deleteCoupon:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const Admin_CouponController = { getCoupons, getCoupon, createCoupon, updateCoupon, deleteCoupon };

export default Admin_CouponController;
