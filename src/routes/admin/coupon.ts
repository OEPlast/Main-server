import express from 'express';
import Admin_CouponController from '@/controller/admin/couponController';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';

const router = express.Router();

router.get('/', authenticateUser, isAdmin, requirePermission('coupons', 'read'), Admin_CouponController.getCoupons);
router.post(
  '/',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'create'),
  Admin_CouponController.createCoupon
);
router.put(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'update'),
  Admin_CouponController.updateCoupon
);
router.delete(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'delete'),
  Admin_CouponController.deleteCoupon
);

export default router;
