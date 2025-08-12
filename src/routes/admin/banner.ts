import express from 'express';
import Admin_BannerController from '../../controller/admin/BannerController';
import { isAdmin, isAuthenticated, requirePermission } from '../../middleware/auth';
import BannerValidator from '../../validators/admin/BannerValidator';

const router = express.Router();

// Apply admin authorization middleware to all routes
router.use(isAuthenticated, isAdmin);

// Banner CRUD routes
router.post(
  '/',
  requirePermission('banners', 'create'),
  BannerValidator.createBannerValidator,
  Admin_BannerController.createBanner
);
router.get(
  '/:id',
  requirePermission('banners', 'read'),
  BannerValidator.getBannerValidator,
  Admin_BannerController.getBannerById
);
router.put(
  '/:id',
  requirePermission('banners', 'update'),
  BannerValidator.updateBannerValidator,
  Admin_BannerController.updateBanner
);
router.delete(
  '/:id',
  requirePermission('banners', 'delete'),
  BannerValidator.deleteBannerValidator,
  Admin_BannerController.deleteBanner
);
router.patch(
  '/:id/toggle-active',
  requirePermission('banners', 'update'),
  BannerValidator.toggleBannerActiveValidator,
  Admin_BannerController.toggleBannerActive
);

export default router;
