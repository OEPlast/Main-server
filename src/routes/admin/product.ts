import express from 'express';
import ProductValidator from '@/validators/admin/Products';
import { isAdmin, isAuthenticated, requirePermission } from '@/middleware/auth';
import Admin_ProductController from '@/controller/admin/ProductController';

const router = express.Router();

// Get product by ID
router.get(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('products', 'read'),
  ProductValidator.getProductByIdValidator,
  Admin_ProductController.getProductById
);

// Create product
router.post(
  '/',
  isAuthenticated,
  isAdmin,
  requirePermission('products', 'create'),
  ProductValidator.createProductValidator,
  Admin_ProductController.createProduct
);

// Update product
router.patch(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('products', 'update'),
  ProductValidator.updateProductValidator,
  Admin_ProductController.updateProduct
);

// Update sub-product
router.post(
  '/duplicate/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('products', 'create'),
  Admin_ProductController.duplicateProduct
);

// Delete product
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('products', 'delete'),
  ProductValidator.deleteProductValidator,
  Admin_ProductController.deleteProduct
);

// update cover image
router.patch(
  '/coverImage/update/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('products', 'update'),
  ProductValidator.updateCoverImageValidator,
  Admin_ProductController.updateCoverImage
);

export default router;
