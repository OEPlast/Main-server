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

export const getPaymentByIdValidator = [
  param('paymentId')
    .notEmpty()
    .withMessage('Payment ID is required')
    .isMongoId()
    .withMessage('Invalid payment ID format'),
];

export const getPaymentByReferenceValidator = [
  param('reference')
    .notEmpty()
    .withMessage('Payment reference is required')
    .isAlphanumeric()
    .withMessage('Invalid reference format'),
];

export const getUserPaymentsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

export const refundPaymentValidator = [
  param('paymentId')
    .notEmpty()
    .withMessage('Payment ID is required')
    .isMongoId()
    .withMessage('Invalid payment ID format'),

  body('reason')
    .notEmpty()
    .withMessage('Refund reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),

  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
];
