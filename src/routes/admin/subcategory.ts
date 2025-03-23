import express from 'express';
import SubCategoryValidator from '@/validators/admin/SubCategoryValidator';
import { isAdmin, isAuthenticated } from '@/middleware/auth';
import SubCategoryController from '@/controller/admin/SubCategoryController';

const router = express.Router();

// Get all subcategories
router.get('/', isAuthenticated, isAdmin, SubCategoryController.getAllSubCategories);

// Create subcategory
router.post(
  '/',
  isAuthenticated,
  isAdmin,
  SubCategoryValidator.createSubCategoryValidator,
  SubCategoryController.createSubCategory
);

// Update subcategory
router.put(
  '/:id',
  isAuthenticated,
  isAdmin,
  SubCategoryValidator.updateSubCategoryValidator,
  SubCategoryController.updateSubCategory
);

// Delete subcategory
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  SubCategoryValidator.deleteSubCategoryValidator,
  SubCategoryController.deleteSubCategory
);

export default router;
