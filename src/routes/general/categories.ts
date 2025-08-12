import express from 'express';
import CategoryController from '../../controller/categoryController';
import CategoryValidator from '../../validators/CategoryValidator';

const router = express.Router();

// Public route to get all categories
router.get('/', ...CategoryValidator.validateCategoryQuery, CategoryController.getAllCategories);

export default router;
