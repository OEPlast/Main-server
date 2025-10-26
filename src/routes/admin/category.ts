import express from 'express';
import CategoryValidator from '@/validators/admin/CategoryValidator';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';
import CategoryController from '@/controller/admin/CategoryController';

const router = express.Router();

// Get all categories
router.get(
  '/all',
  authenticateUser,
  isAdmin,
  requirePermission('categories', 'read'),
  CategoryValidator.listCategoriesValidator,
  CategoryController.getAllCategories
);

// Get all categories list (for dropdowns) - no pagination
router.get(
  '/get-list',
  authenticateUser,
  isAdmin,
  requirePermission('categories', 'read'),
  CategoryController.getCategoriesListAll
);

// Get single category (populated subcategories)
router.get(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('categories', 'read'),
  CategoryController.getCategoryById
);

// Create category
router.post(
  '/create',
  authenticateUser,
  isAdmin,
  requirePermission('categories', 'create'),
  CategoryValidator.createCategoryValidator,
  CategoryController.createCategory
);

// Update category
router.put(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('categories', 'update'),
  CategoryValidator.updateCategoryValidator,
  CategoryController.updateCategory
);

// Delete category
router.delete(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('categories', 'delete'),
  CategoryController.deleteCategory
);

export default router;
