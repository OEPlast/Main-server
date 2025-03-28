import { Router } from 'express';
import ProductController from '../../controller/productController';

const router = Router();

router.get('/all', ProductController.getAllProducts);
router.get('/search', ProductController.searchProducts);

router.get('/week', ProductController.getWeekProducts);
router.get('/top-sold', ProductController.getTopSoldProducts);
router.get('/hot-sales', ProductController.getHotSalesProducts);

router.get('/categoryNSub/:category/:subCat', ProductController.getProductsByCategoryAndSubCategory);
router.get('/:id', ProductController.getProductById);

export default router;
