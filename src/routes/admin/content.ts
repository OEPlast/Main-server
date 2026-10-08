import express from 'express';
import ContentController from '@/controller/ContentController';
import ContentValidator from '@/validators/admin/ContentValidator';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';

/** Admin storefront content (mounted at /admin/content). */
const router = express.Router();
router.use(authenticateUser, isAdmin);

const read = requirePermission('content', 'read');
const create = requirePermission('content', 'create');
const update = requirePermission('content', 'update');
const remove = requirePermission('content', 'delete');

// Articles
router.get('/articles', read, ContentController.adminListArticles);
router.get('/articles/:id', read, ...ContentValidator.idParam, ContentController.adminGetArticle);
router.post('/articles', create, ...ContentValidator.createArticle, ContentController.createArticle);
router.patch('/articles/:id', update, ...ContentValidator.updateArticle, ContentController.updateArticle);
router.delete('/articles/:id', remove, ...ContentValidator.idParam, ContentController.deleteArticle);

// Home content, popular searches, article categories, newsletter popup
router.get('/site', read, ContentController.getSiteContent);
router.put('/site', update, ...ContentValidator.siteContent, ContentController.updateSiteContent);

// FAQs
router.get('/faqs', read, ContentController.getFaqs);
router.post('/faqs', create, ...ContentValidator.createFaqGroup, ContentController.createFaqGroup);
router.patch('/faqs/:id', update, ...ContentValidator.updateFaqGroup, ContentController.updateFaqGroup);
router.delete('/faqs/:id', remove, ...ContentValidator.idParam, ContentController.deleteFaqGroup);

// Legal pages
router.get('/legal', read, ContentController.adminListLegal);
router.get('/legal/:id', read, ...ContentValidator.idParam, ContentController.adminGetLegal);
router.post('/legal', create, ...ContentValidator.createLegal, ContentController.createLegal);
router.patch('/legal/:id', update, ...ContentValidator.updateLegal, ContentController.updateLegal);
router.delete('/legal/:id', remove, ...ContentValidator.idParam, ContentController.deleteLegal);

// Size charts
router.get('/size-charts', read, ContentController.adminListSizeCharts);
router.get('/size-charts/:id', read, ...ContentValidator.idParam, ContentController.adminGetSizeChart);
router.post('/size-charts', create, ...ContentValidator.createSizeChart, ContentController.createSizeChart);
router.patch('/size-charts/:id', update, ...ContentValidator.updateSizeChart, ContentController.updateSizeChart);
router.delete('/size-charts/:id', remove, ...ContentValidator.idParam, ContentController.deleteSizeChart);

export default router;
