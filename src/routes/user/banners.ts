import express from 'express';
import UserBannerController from '@/controller/UserBannerController';
import UserBannerValidator from '@/validators/UserBannerValidator';

const router = express.Router();

/**
 * Get all active banners with optional category filtering
 * Query params:
 *   - category (optional): A, B, C, D, or E
 */
router.get(
  '/',
  UserBannerValidator.validateGetBannersQuery,
  UserBannerController.getAllBanners
);

/**
 * Get all active banners grouped by category
 * Returns object with categories as keys
 */
router.get(
  '/grouped',
  UserBannerController.getBannersGrouped
);

export default router;
