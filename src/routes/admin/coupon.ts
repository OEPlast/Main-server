import express from 'express';
import Admin_CouponController from '@/controller/admin/couponController';
import { isAdmin, isAuthenticated } from '@/middleware/auth';

const router = express.Router();

router.get('/', isAuthenticated, isAdmin, Admin_CouponController.getCoupons);
router.post('/', isAuthenticated, isAdmin, Admin_CouponController.createCoupon);
router.put('/:id', isAuthenticated, isAdmin, Admin_CouponController.updateCoupon);
router.delete('/:id', isAuthenticated, isAdmin, Admin_CouponController.deleteCoupon);

export default router;
