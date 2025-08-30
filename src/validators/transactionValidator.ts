import { body, param, query } from 'express-validator';

export const initializePaymentValidator = [
  body('orderId').notEmpty().withMessage('Order ID is required').isMongoId().withMessage('Invalid order ID format'),

  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),

  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 1 })
    .withMessage('Amount must be greater than 0'),

  body('currency')
    .optional()
    .isIn(['NGN', 'USD', 'GHS', 'ZAR', 'KES'])
    .withMessage('Invalid currency. Supported: NGN, USD, GHS, ZAR, KES'),

  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
];

export const verifyPaymentValidator = [
  param('reference')
    .notEmpty()
    .withMessage('Payment reference is required')
    .isAlphanumeric()
    .withMessage('Invalid reference format'),
];

export const getTransactionByIdValidator = [
  param('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required')
    .isMongoId()
    .withMessage('Invalid transaction ID format'),
];

export const getPaymentByReferenceValidator = [
  param('reference')
    .notEmpty()
    .withMessage('Payment reference is required')
    .isAlphanumeric()
    .withMessage('Invalid reference format'),
];

export const getUserTransactionsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

// Grouped default export for convenience while keeping named exports for compatibility
const TransactionValidator = {
  initializePaymentValidator,
  verifyPaymentValidator,
  getTransactionByIdValidator,
  getPaymentByReferenceValidator,
  getUserTransactionsValidator,
};

export default TransactionValidator;
