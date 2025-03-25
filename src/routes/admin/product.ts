import express from 'express';
import ProductValidator from '@/validators/admin/Products';
import { isAdmin, isAuthenticated } from '@/middleware/auth';
import ProductController from '@/controller/admin/ProductController';

const router = express.Router();

// Get product by ID
router.get(
  '/:id',
  isAuthenticated,
  isAdmin,
  ProductValidator.getProductByIdValidator,
  ProductController.getProductById
);

// Create product
router.post('/', isAuthenticated, isAdmin, ProductValidator.createProductValidator, ProductController.createProduct);

// Update product
router.put('/:id', isAuthenticated, isAdmin, ProductValidator.updateProductValidator, ProductController.updateProduct);

// create sub-product
router.post(
  '/:id/sub',
  isAuthenticated,
  isAdmin,
  ProductValidator.addSubProductValidator,
  ProductController.addSubProduct
);

// Update sub-product
router.put(
  '/:id/sub/:subId',
  isAuthenticated,
  isAdmin,
  ProductValidator.updateSubProductValidator,
  ProductController.updateSubProduct
);

// Delete product
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  ProductValidator.deleteProductValidator,
  ProductController.deleteProduct
);

// update cover image
router.patch(
  '/coverImage/update/:id',
  isAuthenticated,
  isAdmin,
  ProductValidator.updateCoverImageValidator,
  ProductController.updateCoverImage
);

export default router;
