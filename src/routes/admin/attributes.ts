import express from 'express';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';
import AttributesController from '@/controller/admin/AttributesController';
import AttributesValidator from '@/validators/admin/AttributesValidator';

const router = express.Router();

// Create attribute
router.post(
  '/create',
  authenticateUser,
  isAdmin,
  requirePermission('attributes', 'create'),
  AttributesValidator.create_And_Update_AttributeValidator,
  AttributesController.createAttribute
);

// Get all attributes
router.get(
  '/all',
  authenticateUser,
  isAdmin,
  requirePermission('attributes', 'read'),
  AttributesValidator.listAttributesValidator,
  AttributesController.getAllAttributes
);

// Get attribute by id
router.get(
  '/by-id/:id',
  authenticateUser,
  isAdmin,
  requirePermission('attributes', 'read'),
  AttributesValidator.getAttributeByIdValidator,
  AttributesController.getAttributeById
);

// Get attribute by name (prefer explicit path to avoid conflict with :id) => /by-name/:name
router.get(
  '/by-name/:name',
  authenticateUser,
  isAdmin,
  requirePermission('attributes', 'read'),
  AttributesValidator.getAttributeByNameValidator,
  AttributesController.getAttributeByName
);

// Update attribute
router.put(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('attributes', 'update'),
  AttributesValidator.create_And_Update_AttributeValidator,
  AttributesController.updateAttribute
);

// Delete attribute
router.delete(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('attributes', 'delete'),
  AttributesController.deleteAttribute
);

export default router;
