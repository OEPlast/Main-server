import express from 'express';
import CategoryController from '@/controller/categoryController';

const router = express.Router();

router.get('/', CategoryController.getAllCategories);

router.get('/:id', CategoryController.getOneCategoryById);
export default router;
