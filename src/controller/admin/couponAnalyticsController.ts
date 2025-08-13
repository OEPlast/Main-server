import { Request, Response } from 'express';
import CouponAnalyticsService from '@/services/admin/couponAnalyticsService';

const getCouponSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await CouponAnalyticsService.getCouponSummary(id);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (e) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getUsageByDay = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await CouponAnalyticsService.getUsageByDay(id);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (e) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getTopCoupons = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit || 10);
    const result = await CouponAnalyticsService.getTopCoupons(limit);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (e) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getCouponUsers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await CouponAnalyticsService.getCouponUsers(id);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (e) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const Admin_CouponAnalyticsController = { getCouponSummary, getUsageByDay, getTopCoupons, getCouponUsers };
export default Admin_CouponAnalyticsController;
