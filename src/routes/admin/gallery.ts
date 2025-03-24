import GalleryController from '@/controller/admin/GalleryController';
import { isAdmin } from '@/middleware/auth';
import GalleryValidator from '@/validators/admin/GalleryValidator';
import express from 'express';
const router = express.Router();

router.get('/all', isAdmin, GalleryController.getAllImages);
router.post('/new', isAdmin, GalleryValidator.addImageValidator, GalleryController.addImage);
router.patch('/update', isAdmin, GalleryValidator.updateImageValidator, GalleryController.updateImage);
router.delete('/delete', isAdmin, GalleryValidator.deleteImageValidator, GalleryController.deleteImage);

export default router;
