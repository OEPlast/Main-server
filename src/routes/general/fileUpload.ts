import express from 'express';
import FileUploadController from '../../controller/FileUploadController';
import { isAuthenticated } from '../../middleware/auth';

const router = express.Router();

// Protected routes for file management
router.post(
  '/upload/single',
  isAuthenticated,
  FileUploadController.upload.single('file'),
  FileUploadController.uploadSingle
);
router.post(
  '/upload/multiple',
  isAuthenticated,
  FileUploadController.upload.array('files', 10),
  FileUploadController.uploadMultiple
);
router.get('/files/category/:category', isAuthenticated, FileUploadController.getFilesByCategory);
router.delete('/files/:fileId', isAuthenticated, FileUploadController.deleteFile);

export default router;
