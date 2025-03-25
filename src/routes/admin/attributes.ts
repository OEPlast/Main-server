import express from 'express';
import { isAdmin, isAuthenticated } from '@/middleware/auth';
import AttributesController from '@/controller/admin/AttributesController';
import AttributesValidator from '@/validators/admin/AttributesValidator';

const router = express.Router();

// Create attribute
router.post(
  '/',
  isAuthenticated,
  isAdmin,
  AttributesValidator.create_And_Update_AttributeValidator,
  AttributesController.createAttribute
);

// Get all attributes
router.get('/', isAuthenticated, isAdmin, AttributesController.getAllAttributes);

// Update attribute
router.put(
  '/:id',
  isAuthenticated,
  isAdmin,
  AttributesValidator.create_And_Update_AttributeValidator,
  AttributesController.updateAttribute
);

// Delete attribute
router.delete('/:id', isAuthenticated, isAdmin, AttributesController.deleteAttribute);

export default router;
