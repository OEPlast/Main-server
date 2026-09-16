import express from 'express';
import adminReturnController from '../../controller/admin/returnController';
import { authenticateUser, isAdmin, requirePermission } from '../../middleware/auth';
import returnValidator from '../../validators/returnValidator';

const router = express.Router();

// All admin return routes require authentication and admin privileges. There is no `returns`
// permission resource, so returns use `orders`, and paying out a refund needs `transactions:update`
// like the transactions screen's refund. Being staff alone no longer grants any of it.

// Get return statistics (must be before /:id to avoid conflicts)
router.get(
  '/statistics',
  authenticateUser,
  isAdmin,
  requirePermission('orders', 'read'),
  adminReturnController.getReturnStatistics
);

// Get all returns with filtering
router.get(
  '/',
  authenticateUser,
  isAdmin,
  requirePermission('orders', 'read'),
  returnValidator.getReturnsValidator,
  adminReturnController.getAllReturns
);

// Get return by ID
router.get(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('orders', 'read'),
  returnValidator.returnIdValidator,
  adminReturnController.getReturnById
);

// Update return status
router.patch(
  '/:id/status',
  authenticateUser,
  isAdmin,
  requirePermission('orders', 'update'),
  returnValidator.updateReturnStatusValidator,
  adminReturnController.updateReturnStatus
);

// Process refund for a return
router.post(
  '/:id/refund',
  authenticateUser,
  isAdmin,
  requirePermission('transactions', 'update'),
  returnValidator.processRefundValidator,
  adminReturnController.processRefund
);

// Delete return
router.delete(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('orders', 'delete'),
  returnValidator.returnIdValidator,
  adminReturnController.deleteReturn
);

export default router;
