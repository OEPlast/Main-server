import { Router } from 'express';
import CouponController from '@/controller/CouponController';
import { couponCodeValidators, validateCouponValidators } from '@/validators/CouponValidator';

const router = Router();

/**
 * @route   GET /coupons
 * @desc    Get all active public coupons
 * @access  Public
 */
router.get('/', CouponController.getAllCoupons);

/**
 * @route   GET /coupons/cart
 * @desc    Get coupons for cart page display (showOnCartPage: true)
 * @access  Public
 */
router.get('/cart', CouponController.getCartCoupons);

/**
 * @route   GET /coupons/:code
 * @desc    Get coupon details by code
 * @access  Public
 */
router.get('/:code', couponCodeValidators(), CouponController.getCouponByCode);

/**
 * @route   POST /coupons/validate
 * @desc    Validate if coupon can be applied to order
 * @access  Public (but checks userId if logged in)
 */
router.post('/validate', validateCouponValidators(), CouponController.validateCoupon);

export default router;
