import { Router, Request, Response, NextFunction } from 'express';
import TransactionController from '../../controller/TransactionController';
import { authenticateUser } from '../../middleware/auth';
import { validationResult } from 'express-validator';
import TransactionValidator from '../../validators/transactionValidator';

const router = Router();

// Validation middleware
const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: 'Validation failed',
      data: errors.array(),
      code: 400,
    });
    return;
  }
  next();
};

// Initialize payment
// router.post('/initialize', authenticateUser, TransactionValidator.initializePaymentValidator, validate, TransactionController.initializePayment);

// Verify payment
router.get(
  '/verify/:reference',
  TransactionValidator.verifyPaymentValidator,
  validate,
  TransactionController.verifyPayment
);

// Paystack webhook (no auth required)
router.post('/webhook', TransactionController.handleWebhook);

// Get transaction by ID
router.get(
  '/:transactionId',
  authenticateUser,
  TransactionValidator.getTransactionByIdValidator,
  validate,
  TransactionController.getTransactionById
);

// Get user transactions
router.get(
  '/user/transactions',
  authenticateUser,
  TransactionValidator.getUserTransactionsValidator,
  validate,
  TransactionController.getUserTransactions
);

// Get transaction by reference
router.get(
  '/reference/:reference',
  authenticateUser,
  TransactionValidator.getPaymentByReferenceValidator,
  validate,
  TransactionController.getPaymentByReference
);

export default router;
