import express from 'express';
import SubCategoryValidator from '@/validators/admin/SubCategoryValidator';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';
import SubCategoryController from '@/controller/admin/SubCategoryController';

const router = express.Router();

// Get all subcategories
router.get(
  '/',
  authenticateUser,
  isAdmin,
  requirePermission('subcategories', 'read'),
  SubCategoryController.getAllSubCategories
);

// Create subcategory
router.post(
  '/',
  authenticateUser,
  isAdmin,
  requirePermission('subcategories', 'create'),
  SubCategoryValidator.createSubCategoryValidator,
  SubCategoryController.createSubCategory
);

// Update subcategory
router.put(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('subcategories', 'update'),
  SubCategoryValidator.updateSubCategoryValidator,
  SubCategoryController.updateSubCategory
);

// Delete subcategory
router.delete(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('subcategories', 'delete'),
  SubCategoryValidator.deleteSubCategoryValidator,
  SubCategoryController.deleteSubCategory
);

export default router;
