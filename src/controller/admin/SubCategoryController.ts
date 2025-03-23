import { Request, Response } from 'express';
import { Admin_SubCategoryService } from '@/services/admin/Subcategory';

// Get all subcategories
const getAllSubCategories = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await Admin_SubCategoryService.getAllSubCategories();
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getAllSubCategories:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Create subcategory
const createSubCategory = async (req: Request, res: Response) => {
  try {
    const { name, categoryId } = req.body;
    const { data, code, message } = await Admin_SubCategoryService.createSubCategory(name, categoryId);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in createSubCategory:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update subcategory
const updateSubCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const { data, code, message } = await Admin_SubCategoryService.updateSubCategory(id, name);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in updateSubCategory:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete subcategory
const deleteSubCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await Admin_SubCategoryService.deleteSubCategory(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteSubCategory:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const SubCategoryController = {
  getAllSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
};
export default SubCategoryController;
