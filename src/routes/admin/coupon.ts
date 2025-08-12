import express from 'express';
import Admin_CouponController from '@/controller/admin/couponController';
import { isAdmin, isAuthenticated, requirePermission } from '@/middleware/auth';

const router = express.Router();

router.get('/', isAuthenticated, isAdmin, requirePermission('coupons', 'read'), Admin_CouponController.getCoupons);
router.post('/', isAuthenticated, isAdmin, requirePermission('coupons', 'create'), Admin_CouponController.createCoupon);
router.put(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('coupons', 'update'),
  Admin_CouponController.updateCoupon
);
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('coupons', 'delete'),
  Admin_CouponController.deleteCoupon
);

export default router;
