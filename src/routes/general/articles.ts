import express from 'express';
import ContentController from '@/controller/ContentController';

/** Public journal (mounted at /articles). Only published articles are visible. */
const router = express.Router();

/** @route GET /articles?page=&limit=&category= — { items, page, totalPages, total, featured } */
router.get('/', ContentController.listArticles);
/** @route GET /articles/:slug — { article, upNext } */
router.get('/:slug', ContentController.getArticle);

export default router;
