import express from 'express';
import ContentController from '@/controller/ContentController';

/** Public storefront content (mounted at /content). */
const router = express.Router();

/** @route GET /content/home — testimonials, Instagram tiles, popular searches, newsletter popup */
router.get('/home', ContentController.getHome);
/** @route GET /content/faqs — FAQ groups in order */
router.get('/faqs', ContentController.getFaqs);
/** @route GET /content/legal/:slug — e.g. privacy-policy, terms-of-service */
router.get('/legal/:slug', ContentController.getLegal);
/** @route GET /content/size-charts/:slug — e.g. ring, necklace */
router.get('/size-charts/:slug', ContentController.getSizeChart);

export default router;
