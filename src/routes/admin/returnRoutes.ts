import express from 'express';
import adminReturnController from '../../controller/admin/returnController';
import { authenticateUser, isAdmin } from '../../middleware/auth';
import returnValidator from '../../validators/returnValidator';

const router = express.Router();

// All admin return routes require authentication and admin privileges

// Get return statistics (must be before /:id to avoid conflicts)
router.get(
  '/statistics',
  authenticateUser,
  isAdmin,
  adminReturnController.getReturnStatistics
);

// Get all returns with filtering
router.get(
  '/',
  authenticateUser,
  isAdmin,
  returnValidator.getReturnsValidator,
  adminReturnController.getAllReturns
);

// Get return by ID
router.get(
  '/:id',
  authenticateUser,
  isAdmin,
  returnValidator.returnIdValidator,
  adminReturnController.getReturnById
);

// Update return status
router.patch(
  '/:id/status',
  authenticateUser,
  isAdmin,
  returnValidator.updateReturnStatusValidator,
  adminReturnController.updateReturnStatus
);

// Process refund for a return
router.post(
  '/:id/refund',
  authenticateUser,
  isAdmin,
  returnValidator.processRefundValidator,
  adminReturnController.processRefund
);

// Delete return
router.delete(
  '/:id',
  authenticateUser,
  isAdmin,
  returnValidator.returnIdValidator,
  adminReturnController.deleteReturn
);

export default router;
