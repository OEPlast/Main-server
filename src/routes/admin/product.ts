import express from 'express';
import ProductValidator from '@/validators/admin/Products';
import { isAdmin, isAuthenticated } from '@/middleware/auth';
import Admin_ProductController from '@/controller/admin/ProductController';

const router = express.Router();

// Get product by ID
router.get(
  '/:id',
  isAuthenticated,
  isAdmin,
  ProductValidator.getProductByIdValidator,
  Admin_ProductController.getProductById
);

// Create product
router.post(
  '/',
  isAuthenticated,
  isAdmin,
  ProductValidator.createProductValidator,
  Admin_ProductController.createProduct
);

// Update product
router.patch(
  '/:id',
  isAuthenticated,
  isAdmin,
  ProductValidator.updateProductValidator,
  Admin_ProductController.updateProduct
);

// Update sub-product
router.post('/duplicate/:id', isAuthenticated, isAdmin, Admin_ProductController.duplicateProduct);

// Delete product
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  ProductValidator.deleteProductValidator,
  Admin_ProductController.deleteProduct
);

// update cover image
router.patch(
  '/coverImage/update/:id',
  isAuthenticated,
  isAdmin,
  ProductValidator.updateCoverImageValidator,
  Admin_ProductController.updateCoverImage
);

export default router;
