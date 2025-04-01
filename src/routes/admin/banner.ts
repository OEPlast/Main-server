import express from 'express';
import Admin_BannerController from '../../controller/admin/BannerController';
import { isAdmin } from '../../middleware/auth';
import BannerValidator from '../../validators/admin/BannerValidator';

const router = express.Router();

// Apply admin authorization middleware to all routes
router.use(isAdmin);

// Banner CRUD routes
router.post('/', BannerValidator.createBannerValidator, Admin_BannerController.createBanner);
router.get('/:id', BannerValidator.getBannerValidator, Admin_BannerController.getBannerById);
router.put('/:id', BannerValidator.updateBannerValidator, Admin_BannerController.updateBanner);
router.delete('/:id', BannerValidator.deleteBannerValidator, Admin_BannerController.deleteBanner);
router.patch(
  '/:id/toggle-active',
  BannerValidator.toggleBannerActiveValidator,
  Admin_BannerController.toggleBannerActive
);

export default router;
