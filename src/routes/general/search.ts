import express from 'express';
import CatalogController from '@/controller/CatalogController';

const router = express.Router();

/**
 * @route GET /search/suggestions?q=&limit=
 * @desc  { terms, products, total } for the search box; an empty q returns popular searches
 */
router.get('/suggestions', CatalogController.getSuggestions);

export default router;
