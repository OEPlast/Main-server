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

const CategoryController = {
  getAllCategories,
};

export default CategoryController;
