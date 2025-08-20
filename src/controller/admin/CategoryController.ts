import { Request, Response } from 'express';
import { Admin_CategoryService } from '@/services/admin/Category';

// Get all categories
const getAllCategories = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10), 1), 100);
    const response = await Admin_CategoryService.getAllCategories({ page, limit });
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Create category
const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, banner, description, parent } = req.body;
    const { data, code, message } = await Admin_CategoryService.createCategory({ name, banner, description, parent });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in createCategory:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update category
const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, banner, description, parent } = req.body;
    const { data, code, message } = await Admin_CategoryService.updateCategory({
      categoryId: id,
      name,
      banner,
      description,
      parent,
    });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in updateCategory:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete category
const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await Admin_CategoryService.deleteCategory(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteCategory:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get single category with populated subcategories
const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await Admin_CategoryService.getCategoryById(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getCategoryById:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const CategoryController = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryById,
};
export default CategoryController;
