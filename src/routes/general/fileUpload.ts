import express from 'express';
import FileUploadController from '../../controller/FileUploadController';
import FileUploadValidator from '../../validators/FileUploadValidator';
import { authenticateUser, isAdmin } from '../../middleware/auth';

const router = express.Router();

// Protected routes for file management
router.post(
  '/upload/single',
  authenticateUser,
  FileUploadController.upload.single('file'),
  FileUploadValidator.categoryBodyValidator,
  FileUploadController.uploadSingle
);
router.post(
  '/upload/multiple',
  authenticateUser,
  FileUploadController.upload.array('files', 10),
  FileUploadValidator.categoryBodyValidator,
  FileUploadController.uploadMultiple
);
router.get(
  '/category/:category',
  authenticateUser,
  // Staff only: a folder listing includes other customers' return and review photos.
  isAdmin,
  FileUploadValidator.categoryParamValidator,
  FileUploadController.getFilesByCategory
);
// router.delete('/files/:fileId', authenticateUser, FileUploadController.deleteFile);

export default router;
