import { Request, Response } from 'express';
import { isAuthenticatedRequest, AuthenticatedRequest } from '@/types';
import FileUploadService from '../services/FileUploadService';
import multer from 'multer';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const uploadSingle = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Type guard ensures req.userId exists after authentication middleware
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Category already sanitized by validator (if provided) - read from body or query with fallback to 'general'
    type BodyWithCategory = { category?: string };
    const category = (req.body as BodyWithCategory).category ?? (req.query?.category as unknown as string) ?? 'general';
    const uploadedBy = (req as AuthenticatedRequest).userId;

    const result = await FileUploadService.uploadFile(req.file, category, uploadedBy);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in uploadSingle:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const uploadMultiple = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    type BodyWithCategory = { category?: string };
    const category = (req.body as BodyWithCategory).category ?? (req.query?.category as unknown as string) ?? 'general';
    const uploadedBy = req.userId;

    const result = await FileUploadService.uploadMultipleFiles(req.files, category, uploadedBy);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in uploadMultiple:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getFilesByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await FileUploadService.getFilesByCategory(category, Number(page), Number(limit));
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getFilesByCategory:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteFile = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params; // now treated as relative path segment or full relative path
    const result = await FileUploadService.deleteFile(fileId);
    return res.status(result.code).json({ message: result.message });
  } catch (error) {
    console.error('Error in deleteFile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  uploadSingle,
  uploadMultiple,
  getFilesByCategory,
  deleteFile,
  upload,
};
