import { Request, Response } from 'express';
import { Admin_CategoryService } from '@/services/admin/Category';

// Get all categories
const getAllCategories = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await Admin_CategoryService.getAllCategories();
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Create category
const createCategory = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await Admin_CategoryService.createCategory(req.body);
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
    const { data, code, message } = await Admin_CategoryService.updateCategory({ categoryId: id, ...req.body });
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

const CategoryController = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
export default CategoryController;
