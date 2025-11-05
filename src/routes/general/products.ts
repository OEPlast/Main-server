import { Router } from 'express';
import ProductController from '../../controller/productController';
import ProductValidator, { validateProductSlug } from '../../validators/ProductValidator';

const router = Router();

router.get('/all', ...ProductValidator.validateProductQuery, ProductController.getAllProducts);
router.get('/search', ...ProductValidator.validateSearchQuery, ProductController.searchProducts);
router.get('/autocomplete', ProductController.searchAutocomplete);

router.get('/new-products', ProductController.getNewProducts);
router.get('/new-products/filters', ProductController.getNewProductsFilters);
router.get('/top-week', ProductController.getWeekProducts);
router.get('/top-week/filters', ProductController.getWeekProductsFilters);
router.get('/top-sold', ProductController.getTopSoldProducts);
router.get('/top-sold/filters', ProductController.getTopSoldProductsFilters);
router.get('/hot-sales', ProductController.getHotSalesProducts);
router.get('/deals-of-the-day', ProductController.getDealsOfTheDay);
router.get('/recommendation', ProductController.getRecommendation);
router.get('/recommendation4u', ProductController.getProductRecommendations);
router.get('/top-categories', ProductController.getTopCategories);

// Campaign products - must come before /by-slug to avoid route conflicts
router.get('/campaign/:slug', ProductController.getProductsByCampaignSlug);

router.get('/category/:slug', ...ProductValidator.validateCategorySlug, ProductController.getByCategorySlug);
router.get('/by-slug/:slug', ...validateProductSlug, ProductController.getProductBySlug);
router.get('/by-id/:id', ...ProductValidator.validateProductId, ProductController.getProductById);

export default router;
