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
    const { startDate, endDate, coupon, discount, active } = req.body;
    const mainData = { startDate, endDate, discount: Number(discount), active, creator: user, coupon } as unknown as {
      coupon: string;
      startDate: string;
      endDate: string;
      discount: number;
      active: boolean;
      creator: string;
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
    const { startDate, endDate, discount, active, couponType, deleted } = req.body;

    const updateData = { startDate, endDate, discount: Number(discount), active, couponType, deleted } as unknown as {
      startDate: string;
      endDate: string;
      discount: number;
      active: boolean;
      deleted: boolean;
    };
    const { message, data, code } = await CouponService.updateCoupon(id, updateData);
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
