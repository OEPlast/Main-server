import { Request, Response } from 'express';
import GalleryService from '../../services/admin/GalleryService';

// Add one or more images to the gallery
const addImage = async (req: Request, res: Response) => {
  try {
    const { images } = req.body;
    const { data, message, code } = await GalleryService.addImage(images);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in addImage:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all images in the gallery with optional pagination
const getAllImages = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { data, message, code } = await GalleryService.getAllImages({
      page: Number(page),
      limit: Number(limit),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAllImages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete one or more images from the gallery
const deleteImage = async (req: Request, res: Response) => {
  try {
    const { imageIds } = req.body;
    const { message, code } = await GalleryService.deleteImage(imageIds);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in deleteImage:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update the title and description of an image
const updateImage = async (req: Request, res: Response) => {
  try {
    const { image, updates } = req.body;
    const { data, message, code } = await GalleryService.updateImage(image, updates);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateImage:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default { addImage, getAllImages, deleteImage, updateImage };
