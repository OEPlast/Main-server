import express from 'express';
import Admin_OrderController from '../../controller/admin/OrderController';

const router = express.Router();

// Route to fetch the 15 most ordered products within a time frame
router.get('/top-ordered-products', Admin_OrderController.getTopOrderedProducts);

export default router;
