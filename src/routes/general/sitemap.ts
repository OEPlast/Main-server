import { Router } from 'express';
import SitemapController from '../../controller/SitemapController';

const router = Router();

/**
 * @route GET /sitemap/products
 * @desc Get all product slugs for sitemap generation
 * @access Public
 */
router.get('/products', SitemapController.getProductSlugs);

/**
 * @route GET /sitemap/categories
 * @desc Get all category slugs for sitemap generation
 * @access Public
 */
router.get('/categories', SitemapController.getCategorySlugs);

export default router;
