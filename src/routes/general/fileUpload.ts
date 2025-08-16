import express from 'express';
import FileUploadController from '../../controller/FileUploadController';
import { authenticateUser } from '../../middleware/auth';

const router = express.Router();

// Protected routes for file management
router.post(
  '/upload/single',
  authenticateUser,
  FileUploadController.upload.single('file'),
  FileUploadController.uploadSingle
);
router.post(
  '/upload/multiple',
  authenticateUser,
  FileUploadController.upload.array('files', 10),
  FileUploadController.uploadMultiple
);
router.get('/files/category/:category', authenticateUser, FileUploadController.getFilesByCategory);
router.delete('/files/:fileId', authenticateUser, FileUploadController.deleteFile);

export default router;
