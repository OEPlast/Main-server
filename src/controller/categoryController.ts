import { Request, Response } from 'express';
import { CategoryService } from '../services/Category';

// Get all categories (public route)
const getAllCategories = async (req: Request, res: Response) => {
  try {
    const { data, message, code } = await CategoryService.getAllCategories();
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
// Get all categories (public route)
const getOneCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, message, code } = await CategoryService.getCategoryById(id);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const CategoryController = {
  getAllCategories,
  getOneCategoryById,
};

export default CategoryController;
