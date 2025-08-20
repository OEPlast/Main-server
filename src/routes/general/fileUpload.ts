import express from 'express';
import FileUploadController from '../../controller/FileUploadController';
import FileUploadValidator from '../../validators/FileUploadValidator';
import { authenticateUser } from '../../middleware/auth';

const router = express.Router();

// Protected routes for file management
router.post(
  '/upload/single',
  authenticateUser,
  FileUploadValidator.categoryBodyValidator,
  FileUploadController.upload.single('file'),
  FileUploadController.uploadSingle
);
router.post(
  '/upload/multiple',
  authenticateUser,
  FileUploadValidator.categoryBodyValidator,
  FileUploadController.upload.array('files', 10),
  FileUploadController.uploadMultiple
);
router.get(
  '/category/:category',
  authenticateUser,
  FileUploadValidator.categoryParamValidator,
  FileUploadController.getFilesByCategory
);
// router.delete('/files/:fileId', authenticateUser, FileUploadController.deleteFile);

export default router;
