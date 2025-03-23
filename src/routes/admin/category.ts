import express from 'express';
import CategoryValidator from '@/validators/admin/CategoryValidator';
import { isAdmin, isAuthenticated } from '@/middleware/auth';
import CategoryController from '@/controller/admin/CategoryController';

const router = express.Router();

// Get all categories
router.get(
  '/',
  isAuthenticated,
  isAdmin,
  CategoryValidator.getAllCategoriesValidator,
  CategoryController.getAllCategories
);

// Create category
router.post(
  '/',
  isAuthenticated,
  isAdmin,
  CategoryValidator.createCategoryValidator,
  CategoryController.createCategory
);

// Update category
router.put(
  '/:id',
  isAuthenticated,
  isAdmin,
  CategoryValidator.updateCategoryValidator,
  CategoryController.updateCategory
);

// Delete category
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  CategoryValidator.deleteCategoryValidator,
  CategoryController.deleteCategory
);

export default router;
