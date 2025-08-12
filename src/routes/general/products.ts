import { Router } from 'express';
import ProductController from '../../controller/productController';
import ProductValidator from '../../validators/ProductValidator';

const router = Router();

router.get('/', ...ProductValidator.validateProductQuery, ProductController.getAllProducts);
router.get('/search', ...ProductValidator.validateSearchQuery, ProductController.searchProducts);

router.get('/week', ProductController.getWeekProducts);
router.get('/top-sold', ProductController.getTopSoldProducts);
router.get('/hot-sales', ProductController.getHotSalesProducts);
router.get('/recommendation', ProductController.getRecommendation);
router.get('/recommendation4u', ProductController.getRecommendation);

router.get('/categoryNSub/:category/:subCat', ProductController.getProductsByCategoryAndSubCategory);
router.get('/:id', ...ProductValidator.validateProductId, ProductController.getProductById);

export default router;
