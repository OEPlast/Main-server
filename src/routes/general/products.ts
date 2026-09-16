import { Router, Request, Response } from 'express';
import Product from '@/models/Product';
import ProductController from '../../controller/productController';
import ProductValidator, { validateProductSlug } from '../../validators/ProductValidator';

const router = Router();

router.get('/all', ...ProductValidator.validateProductQuery, ProductController.getAllProducts);
router.get('/search', ...ProductValidator.validateSearchQuery, ProductController.searchProducts);
router.get('/search-results', ProductController.getSearchResults); // Full product data for search results page
router.get('/search-filters', ProductController.getSearchFilters); // Aggregated filters for search
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

// Product comparison - must come before /by-slug to avoid route conflicts
router.get('/compare', ProductController.getProductsForComparison);

router.get('/category/:slug', ...ProductValidator.validateCategorySlug, ProductController.getByCategorySlug);
router.get('/by-slug/:slug', ...validateProductSlug, ProductController.getProductBySlugOrIdController);

/**
 * GET /products/slug-redirect/:slug → { slug } when `slug` is a former slug of a product.
 * The storefront calls this only after /by-slug found nothing, then 301s to the current URL.
 */
router.get('/slug-redirect/:slug', ...validateProductSlug, async (req: Request, res: Response) => {
  try {
    const product = await Product.findOne({ slugHistory: req.params.slug, slug: { $ne: req.params.slug } })
      .select('slug')
      .lean();
    if (!product) return res.status(404).json({ message: 'No redirect', data: null, code: 404 });
    return res.status(200).json({ message: 'Product moved', data: { slug: product.slug }, code: 200 });
  } catch {
    return res.status(500).json({ message: 'Could not look up redirect', data: null, code: 500 });
  }
});
router.get('/by-id/:id', ...ProductValidator.validateProductId, ProductController.getProductById);

// Related products and popular products
router.get(
  '/:productId/related',
  ...ProductValidator.validateProductId,
  ProductController.getRelatedProductsController
);
router.get('/popular', ProductController.getPopularProductsController);

export default router;
