import express from 'express';
import BannerController from '../../controller/bannerController';
import BannerValidator from '../../validators/BannerValidator';

const router = express.Router();

// Public routes for banners - only active banners are returned
router.get('/', ...BannerValidator.validateBannerQuery, BannerController.getBanners);

export default router;
