import { Request, Response } from 'express';
import { AuthenticatedRequest, isAuthenticatedRequest } from '../../types';
import CouponService from '../../services/admin/couponService';

// Get all coupons
const getCoupons = async (req: Request, res: Response) => {
  try {
    const { message, data, code } = await CouponService.getAllCoupons();
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
    const { startDate, endDate, coupon, discount, active, couponType, allowedUser } = req.body as {
      coupon: string;
      startDate: string;
      endDate: string;
      discount: number | string;
      active: boolean;
      couponType?: 'one-off' | 'one-off-user' | 'one-off-for-one-person' | 'normal';
      allowedUser?: string | null;
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
