import { Request, Response } from 'express';
import CouponService from '@/services/CouponService';

const CouponController = {
  /**
   * Get all active public coupons
   * GET /coupons
   */
  async getAllCoupons(req: Request, res: Response) {
    try {
      const { data, message, code } = await CouponService.getAllPublicCoupons();
      return res.status(code).json({ message, data });
    } catch (error) {
      console.error('Get all coupons error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Get coupons to display on cart page
   * GET /coupons/cart
   */
  async getCartCoupons(req: Request, res: Response) {
    try {
      const { data, message, code } = await CouponService.getCartCoupons();
      return res.status(code).json({ message, data });
    } catch (error) {
      console.error('Get cart coupons error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Get coupon by code
   * GET /coupons/:code
   */
  async getCouponByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const result = await CouponService.getCouponByCode(code);
      return res.status(result.code).json({ message: result.message, data: result.data });
    } catch (error) {
      console.error('Get coupon by code error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Validate if coupon can be applied
   * POST /coupons/validate
   */
  async validateCoupon(req: Request, res: Response) {
    try {
      const { code, orderTotal, productIds, categoryIds } = req.body;

      // Get userId from session if available
      const userId = (req as Request & { user?: { userId: string } }).user?.userId;

      const result = await CouponService.validateCoupon({
        code,
        orderTotal,
        productIds,
        categoryIds,
        userId,
      });

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: result.message,
        });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        data: {
          coupon: result.coupon,
          discount: result.discount,
          discountType: result.discountType,
          appliesTo: result.appliesTo,
        },
        message: result.message,
      });
    } catch (error) {
      console.error('Validate coupon error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
};

export default CouponController;
