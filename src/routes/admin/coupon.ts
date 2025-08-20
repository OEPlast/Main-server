import express from 'express';
import Admin_CouponController from '@/controller/admin/couponController';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';
import CouponValidator, { couponListQueryValidator } from '@/validators/admin/CouponValidator';

const router = express.Router();

router.get(
  '/',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'read'),
  couponListQueryValidator,
  Admin_CouponController.getCoupons
);
router.get(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'read'),
  CouponValidator.couponIdParamValidator,
  Admin_CouponController.getCoupon
);
router.post(
  '/create',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'create'),
  CouponValidator.createCouponValidator,
  Admin_CouponController.createCoupon
);
router.put(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'update'),
  CouponValidator.updateCouponValidator,
  Admin_CouponController.updateCoupon
);
router.delete(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('coupons', 'delete'),
  CouponValidator.couponIdParamValidator,
  Admin_CouponController.deleteCoupon
);

export default router;
