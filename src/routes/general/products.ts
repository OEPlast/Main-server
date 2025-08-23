import { Router } from 'express';
import ProductController from '../../controller/productController';
import ProductValidator, { validateProductSlug } from '../../validators/ProductValidator';

const router = Router();

router.get('/all', ...ProductValidator.validateProductQuery, ProductController.getAllProducts);
router.get('/search', ...ProductValidator.validateSearchQuery, ProductController.searchProducts);

router.get('/week', ProductController.getWeekProducts);
router.get('/top-sold', ProductController.getTopSoldProducts);
router.get('/hot-sales', ProductController.getHotSalesProducts);
router.get('/recommendation', ProductController.getRecommendation);
router.get('/recommendation4u', ProductController.getProductRecommendations);

router.get('/category/:slug', ...ProductValidator.validateCategorySlug, ProductController.getByCategorySlug);
router.get('/by-slug/:slug', ...validateProductSlug, ProductController.getProductBySlug);
router.get('/by-id/:id', ...ProductValidator.validateProductId, ProductController.getProductById);

export default router;
