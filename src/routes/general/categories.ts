import express from 'express';
import CatalogController from '@/controller/CatalogController';
import CategoryController from '@/controller/categoryController';
import { categorySlugValidators } from '@/validators/CategoryValidator';

const router = express.Router();

router.get('/', CategoryController.getAllCategories);

// Every category as a tree with active product counts, plus the curated collections
router.get('/tree', CatalogController.getCategoryTree);
router.get('/:id', CategoryController.getOneCategoryById);

// Get category by slug
router.get('/slug/:slug', ...categorySlugValidators(), CategoryController.getCategoryBySlug);

// Filters for a category by slug
router.get('/slug/:slug/filters', ...categorySlugValidators(), CategoryController.getCategoryFilters);
export default router;
