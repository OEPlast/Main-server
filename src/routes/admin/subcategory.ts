import express from 'express';
import SubCategoryValidator from '@/validators/admin/SubCategoryValidator';
import { isAdmin, isAuthenticated, requirePermission } from '@/middleware/auth';
import SubCategoryController from '@/controller/admin/SubCategoryController';

const router = express.Router();

// Get all subcategories
router.get(
  '/',
  isAuthenticated,
  isAdmin,
  requirePermission('subcategories', 'read'),
  SubCategoryController.getAllSubCategories
);

// Create subcategory
router.post(
  '/',
  isAuthenticated,
  isAdmin,
  requirePermission('subcategories', 'create'),
  SubCategoryValidator.createSubCategoryValidator,
  SubCategoryController.createSubCategory
);

// Update subcategory
router.put(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('subcategories', 'update'),
  SubCategoryValidator.updateSubCategoryValidator,
  SubCategoryController.updateSubCategory
);

// Delete subcategory
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('subcategories', 'delete'),
  SubCategoryValidator.deleteSubCategoryValidator,
  SubCategoryController.deleteSubCategory
);

export default router;
