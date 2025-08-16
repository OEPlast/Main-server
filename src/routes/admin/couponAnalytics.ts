import express from 'express';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';
import Admin_CouponAnalyticsController from '@/controller/admin/couponAnalyticsController';

const router = express.Router();

router.get(
  '/top',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'read'),
  Admin_CouponAnalyticsController.getTopCoupons
);
router.get(
  '/:id/summary',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'read'),
  Admin_CouponAnalyticsController.getCouponSummary
);
router.get(
  '/:id/usage-by-day',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'read'),
  Admin_CouponAnalyticsController.getUsageByDay
);
router.get(
  '/:id/users',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'read'),
  Admin_CouponAnalyticsController.getCouponUsers
);

export default router;
