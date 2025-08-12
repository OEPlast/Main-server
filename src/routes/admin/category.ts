import express from 'express';
import CategoryValidator from '@/validators/admin/CategoryValidator';
import { isAdmin, isAuthenticated, requirePermission } from '@/middleware/auth';
import CategoryController from '@/controller/admin/CategoryController';

const router = express.Router();

// Get all categories
router.get('/', isAuthenticated, isAdmin, requirePermission('categories', 'read'), CategoryController.getAllCategories);

// Create category
router.post(
  '/',
  isAuthenticated,
  isAdmin,
  requirePermission('categories', 'create'),
  CategoryValidator.createCategoryValidator,
  CategoryController.createCategory
);

// Update category
router.put(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('categories', 'update'),
  CategoryValidator.updateCategoryValidator,
  CategoryController.updateCategory
);

// Delete category
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('categories', 'delete'),
  CategoryController.deleteCategory
);

export default router;
