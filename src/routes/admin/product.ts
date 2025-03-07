import express from 'express';
import ProductValidator from '@/validators/admin/Products';
import { isAdmin, isAuthenticated } from '@/middleware/auth';
import ProductController from '@/controller/admin/ProductController';

const router = express.Router();

// Get all products
router.get('/', isAuthenticated, isAdmin, ProductValidator.getAllProductsValidator, ProductController.getAllProducts);

// Search products
router.get(
  '/search',
  isAuthenticated,
  isAdmin,
  ProductValidator.searchProductsValidator,
  ProductController.searchProducts
);

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

// Delete sub-product
router.delete(
  '/:id/sub/:subId',
  isAuthenticated,
  isAdmin,
  ProductValidator.deleteSubProductValidator,
  ProductController.deleteSubProduct
);

export default router;
