import { Router } from 'express';
import {
  getAllProducts,
  searchProducts,
  getWeekProducts,
  getTopSoldProducts,
  getHotSalesProducts,
  getProductsByCategory,
  getProductById,
  getProductStockById,
  getProductReviewsById,
} from '../../controller/productController';

const router = Router();

router.get('/all', getAllProducts);
router.get('/search', searchProducts);
router.get('/week', getWeekProducts);
router.get('/top-sold', getTopSoldProducts);
router.get('/hot-sales', getHotSalesProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProductById);
router.get('/:id/stock', getProductStockById);
router.get('/:id/review', getProductReviewsById);

export default router;
