import express from 'express';
import Admin_TransactionController from '../../controller/admin/TransactionController';
import Admin_TransactionValidator from '../../validators/admin/TransactionValidator';
import { authenticateUser, isAdmin, requirePermission } from '../../middleware/auth';
import TransactionController from '@/controller/TransactionController';

const router = express.Router();

// All admin transaction routes require authentication and admin privileges
router.use(authenticateUser, isAdmin);

// Get transaction statistics
router.get(
  '/statistics',
  requirePermission('transactions', 'read'),
  Admin_TransactionController.getStatistics
);

// Transaction management routes
router.get(
  '/',
  requirePermission('transactions', 'read'),
  Admin_TransactionValidator.validateTransactionQueryParams,
  Admin_TransactionController.getTransactions
);

router.get(
  '/:transactionId',
  requirePermission('transactions', 'read'),
  Admin_TransactionValidator.validateTransactionId,
  Admin_TransactionController.getTransactionById
);

router.put(
  '/:transactionId',
  requirePermission('transactions', 'update'),
  Admin_TransactionValidator.validateUpdateTransaction,
  Admin_TransactionController.updateTransaction
);

// Refund transaction (admin only)
router.post(
  '/:transactionId/refund',
  requirePermission('transactions', 'update'),
  Admin_TransactionValidator.refundTransactionValidator,
  Admin_TransactionController.processRefund
);

export default router;
