import express from 'express';
import BannerController from '../../controller/bannerController';
import BannerValidator from '../../validators/BannerValidator';
import Admin_BannerController from '@/controller/admin/BannerController';

const router = express.Router();

router.get('/', BannerValidator.validateBannerQuery, BannerController.getBanners);

router.get('/:id', BannerValidator.validateBannerId, Admin_BannerController.getBannerById);

export default router;
