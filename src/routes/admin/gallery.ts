import GalleryController from '@/controller/admin/GalleryController';
import { isAdmin, isAuthenticated, requirePermission } from '@/middleware/auth';
import GalleryValidator from '@/validators/admin/GalleryValidator';
import express from 'express';
const router = express.Router();

router.get('/all', isAuthenticated, isAdmin, requirePermission('gallery', 'read'), GalleryController.getAllImages);
router.post(
  '/new',
  isAuthenticated,
  isAdmin,
  requirePermission('gallery', 'create'),
  GalleryValidator.addImageValidator,
  GalleryController.addImage
);
router.patch(
  '/update',
  isAuthenticated,
  isAdmin,
  requirePermission('gallery', 'update'),
  GalleryValidator.updateImageValidator,
  GalleryController.updateImage
);
router.delete(
  '/delete',
  isAuthenticated,
  isAdmin,
  requirePermission('gallery', 'delete'),
  GalleryValidator.deleteImageValidator,
  GalleryController.deleteImage
);

export default router;
