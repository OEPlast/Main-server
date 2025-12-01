import { Request, Response } from 'express';
import { CategoryService } from '../services/Category';

// Get all categories (public route)
const getAllCategories = async (req: Request, res: Response) => {
  try {
    const { data, message, code,meta } = await CategoryService.getAllCategories();
    return res.status(code).json({ message, data, meta });
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
  async getCategoryBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params as { slug: string };
      const result = await CategoryService.getCategoryBySlug(slug);
      return res.status(result.code).json({ message: result.message, data: result.data });
    } catch (error) {
      console.error('Error in getCategoryBySlug:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  async getCategoryFilters(req: Request, res: Response) {
    try {
      const { slug } = req.params as { slug: string };
      const result = await CategoryService.getCategoryFilters(slug);
      return res.status(result.code).json({ message: result.message, data: result.data });
    } catch (error) {
      console.error('Error in getCategoryFilters:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
};

export default CategoryController;
