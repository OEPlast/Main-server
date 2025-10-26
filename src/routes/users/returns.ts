import express from 'express';
import ReturnController from '../../controller/returnController';
import ReturnValidator from '../../validators/returnValidator';
import { authenticateUser } from '@/middleware/auth';

/**
 * Customer Return Routes
 * All routes require authentication
 * Users can only access their own returns
 */

const router = express.Router();

/**
 * POST /returns
 * Initiate a new return request
 * Body: { orderId, items, type, customerNotes }
 */
router.post(
  '/',
  authenticateUser,
  ReturnValidator.initiateReturnValidator,
  ReturnController.initiateReturn
);

/**
 * GET /returns
 * Get all returns for authenticated user
 * Query: page, limit, status
 */
router.get(
  '/',
  authenticateUser,
  ReturnValidator.getMyReturnsValidator,
  ReturnController.getMyReturns
);

/**
 * GET /returns/:id
 * Get specific return details (must belong to user)
 */
router.get(
  '/:id',
  authenticateUser,
  ReturnValidator.returnIdValidator,
  ReturnController.getReturnById
);

/**
 * POST /returns/:id/cancel
 * Cancel a return request (only if status is pending)
 */
router.post(
  '/:id/cancel',
  authenticateUser,
  ReturnValidator.returnIdValidator,
  ReturnController.cancelReturn
);

export default router;
