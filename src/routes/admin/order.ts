import express from 'express';
import Admin_OrderController from '../../controller/admin/OrderController';
import Admin_OrderValidator from '../../validators/admin/OrderValidator';
import { authenticateUser, isAdmin, requirePermission } from '../../middleware/auth';

const router = express.Router();

// All admin order routes require authentication and admin privileges
router.use(authenticateUser, isAdmin);

// Route to fetch the 15 most ordered products within a time frame
router.get(
  '/top-ordered-products',
  requirePermission('orders', 'read'),
  Admin_OrderValidator.validateTopOrderedProducts,
  Admin_OrderController.getTopOrderedProducts
);

// Order management routes
router.get(
  '/',
  requirePermission('orders', 'read'),
  Admin_OrderValidator.validatePagination,
  Admin_OrderController.getOrders
);
router.get(
  '/returns',
  requirePermission('orders', 'read'),
  Admin_OrderValidator.validatePagination,
  Admin_OrderController.getAllReturns
);
router.get('/:id', requirePermission('orders', 'read'), Admin_OrderController.getOrderById);
router.put(
  '/:id',
  requirePermission('orders', 'update'),
  Admin_OrderValidator.updateOrderDetails,
  Admin_OrderController.updateOrderDetails
);
router.patch(
  '/:id/delivery',
  requirePermission('orders', 'update'),
  Admin_OrderValidator.updateDeliveryTimeline,
  Admin_OrderController.updateDeliveryTimeline
);
router.delete(
  '/:id',
  requirePermission('orders', 'delete'),
  Admin_OrderValidator.validateRejectOrder,
  Admin_OrderController.rejectOrder
);
router.delete('/:id/cancel', requirePermission('orders', 'update'), Admin_OrderController.cancelOrder);

export default router;
