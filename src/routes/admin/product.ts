import express from 'express';
import ProductValidator from '@/validators/admin/Products';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';
import Admin_ProductController from '@/controller/admin/ProductController';

const router = express.Router();

// Create product
router.post(
  '/create',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'create'),
  ProductValidator.createProductValidator,
  Admin_ProductController.createProduct
);

// Get product by ID
router.get(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'read'),
  ProductValidator.getProductByIdValidator,
  Admin_ProductController.getProductById
);

// Update product
router.patch(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'update'),
  ProductValidator.updateProductValidator,
  Admin_ProductController.updateProduct
);

// Update sub-product
router.post(
  '/duplicate/:id',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'create'),
  Admin_ProductController.duplicateProduct
);

// Delete product
router.delete(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'delete'),
  ProductValidator.deleteProductValidator,
  Admin_ProductController.deleteProduct
);

// update cover image
router.patch(
  '/coverImage/update/:id',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'update'),
  ProductValidator.updateCoverImageValidator,
  Admin_ProductController.updateCoverImage
);

export default router;
// Array edit endpoints
router.post(
  '/:productId/tags',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'update'),
  ProductValidator.addTagsValidator,
  Admin_ProductController.addTags
);

router.delete(
  '/:productId/tags/:tag',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'update'),
  ProductValidator.removeTagValidator,
  Admin_ProductController.removeTag
);

router.post(
  '/:productId/specifications',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'update'),
  ProductValidator.addSpecificationsValidator,
  Admin_ProductController.addSpecifications
);

router.delete(
  '/:productId/specifications',
  authenticateUser,
  isAdmin,
  requirePermission('products', 'update'),
  ProductValidator.removeSpecificationValidator,
  Admin_ProductController.removeSpecification
);
