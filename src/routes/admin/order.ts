import express from 'express';
import Admin_OrderController from '../../controller/admin/OrderController';
import { isAdmin, isAuthenticated } from '@/middleware/auth';
import OrderValidator from '@/validators/admin/OrderValidator';

const router = express.Router();

// Fetch paginated orders
router.get('/', isAuthenticated, isAdmin, Admin_OrderController.getOrders);
router.get('/:orderId', isAuthenticated, isAdmin, Admin_OrderController.getOrderById);

// Update delivery timeline
router.put(
  '/:orderId/timeline',
  isAuthenticated,
  isAdmin,
  OrderValidator.updateDeliveryTimeline,
  Admin_OrderController.updateDeliveryTimeline
);
router.put(
  '/:orderId/reject',
  isAuthenticated,
  isAdmin,
  OrderValidator.validateRejectOrder,
  Admin_OrderController.rejectOrder
);
router.delete('/:orderId', isAuthenticated, isAdmin, Admin_OrderController.cancelOrder);

router.put(
  '/:orderId',
  isAuthenticated,
  isAdmin,
  OrderValidator.updateOrderDetails,
  Admin_OrderController.updateOrderDetails
);

export default router;
