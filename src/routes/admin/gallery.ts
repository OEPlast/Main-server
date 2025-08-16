import GalleryController from '@/controller/admin/GalleryController';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';
import GalleryValidator from '@/validators/admin/GalleryValidator';
import express from 'express';
const router = express.Router();

router.get('/all', authenticateUser, isAdmin, requirePermission('gallery', 'read'), GalleryController.getAllImages);
router.post(
  '/new',
  authenticateUser,
  isAdmin,
  requirePermission('gallery', 'create'),
  GalleryValidator.addImageValidator,
  GalleryController.addImage
);
router.patch(
  '/update',
  authenticateUser,
  isAdmin,
  requirePermission('gallery', 'update'),
  GalleryValidator.updateImageValidator,
  GalleryController.updateImage
);
router.delete(
  '/delete',
  authenticateUser,
  isAdmin,
  requirePermission('gallery', 'delete'),
  GalleryValidator.deleteImageValidator,
  GalleryController.deleteImage
);

export default router;
