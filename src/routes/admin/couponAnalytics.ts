import express from 'express';
import { isAdmin, isAuthenticated, requirePermission } from '@/middleware/auth';
import Admin_CouponAnalyticsController from '@/controller/admin/couponAnalyticsController';

const router = express.Router();

router.get(
  '/top',
  isAuthenticated,
  isAdmin,
  requirePermission('coupons', 'read'),
  Admin_CouponAnalyticsController.getTopCoupons
);
router.get(
  '/:id/summary',
  isAuthenticated,
  isAdmin,
  requirePermission('coupons', 'read'),
  Admin_CouponAnalyticsController.getCouponSummary
);
router.get(
  '/:id/usage-by-day',
  isAuthenticated,
  isAdmin,
  requirePermission('coupons', 'read'),
  Admin_CouponAnalyticsController.getUsageByDay
);
router.get(
  '/:id/users',
  isAuthenticated,
  isAdmin,
  requirePermission('coupons', 'read'),
  Admin_CouponAnalyticsController.getCouponUsers
);

export default router;
