import express from 'express';
import BannerController from '../../controller/bannerController';

const router = express.Router();

// Public routes for banners - only active banners are returned
router.get('/all', BannerController.getBanners);

export default router;
