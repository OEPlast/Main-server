import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, validationResult } from 'express-validator';

const validatePagination = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      page: {
        in: ['query'],
        optional: true,
        isInt: {
          options: { min: 1 },
          errorMessage: 'Page must be a positive integer',
        },
      },
      limit: {
        in: ['query'],
        optional: true,
        isInt: {
          options: { min: 1, max: 100 },
          errorMessage: 'Limit must be a positive integer between 1 and 100',
        },
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateTransactionQueryParams = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      page: {
        in: ['query'],
        optional: true,
        isInt: {
          options: { min: 1 },
          errorMessage: 'Page must be a positive integer',
        },
      },
      limit: {
        in: ['query'],
        optional: true,
        isInt: {
          options: { min: 1, max: 100 },
          errorMessage: 'Limit must be a positive integer between 1 and 100',
        },
      },
      status: {
        in: ['query'],
        optional: true,
        isIn: {
          options: [['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded']],
          errorMessage: 'Status must be one of: pending, completed, failed, cancelled, refunded, partially_refunded',
        },
      },
      paymentMethod: {
        in: ['query'],
        optional: true,
        isIn: {
          options: [['stripe', 'paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery']],
          errorMessage: 'Payment method must be one of: stripe, paystack, flutterwave, bank_transfer, cash_on_delivery',
        },
      },
      userId: {
        in: ['query'],
        optional: true,
        isMongoId: {
          errorMessage: 'User ID must be a valid MongoDB ID',
        },
      },
      orderId: {
        in: ['query'],
        optional: true,
        isMongoId: {
          errorMessage: 'Order ID must be a valid MongoDB ID',
        },
      },
      transactionType: {
        in: ['query'],
        optional: true,
        isIn: {
          options: [['order_payment', 'return_refund']],
          errorMessage: 'Transaction type must be one of: order_payment, return_refund',
        },
      },
      startDate: {
        in: ['query'],
        optional: true,
        isISO8601: {
          errorMessage: 'Start date must be a valid ISO 8601 date',
        },
      },
      endDate: {
        in: ['query'],
        optional: true,
        isISO8601: {
          errorMessage: 'End date must be a valid ISO 8601 date',
        },
      },
      minAmount: {
        in: ['query'],
        optional: true,
        isFloat: {
          options: { min: 0 },
          errorMessage: 'Minimum amount must be a positive number',
        },
      },
      maxAmount: {
        in: ['query'],
        optional: true,
        isFloat: {
          options: { min: 0 },
          errorMessage: 'Maximum amount must be a positive number',
        },
      },
      reference: {
        in: ['query'],
        optional: true,
        isString: {
          errorMessage: 'Reference must be a string',
        },
        trim: true,
      },
      transactionId: {
        in: ['query'],
        optional: true,
        isString: {
          errorMessage: 'Transaction ID must be a string',
        },
        trim: true,
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateTransactionId = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      transactionId: {
        in: ['params'],
        isMongoId: {
          errorMessage: 'Transaction ID must be a valid MongoDB ID',
        },
        notEmpty: {
          errorMessage: 'Transaction ID is required',
        },
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateUpdateTransaction = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      transactionId: {
        in: ['params'],
        isMongoId: {
          errorMessage: 'Transaction ID must be a valid MongoDB ID',
        },
        notEmpty: {
          errorMessage: 'Transaction ID is required',
        },
      },
      status: {
        in: ['body'],
        optional: true,
        isIn: {
          options: [['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded']],
          errorMessage: 'Status must be one of: pending, completed, failed, cancelled, refunded, partially_refunded',
        },
      },
      paidAt: {
        in: ['body'],
        optional: true,
        isISO8601: {
          errorMessage: 'Paid at must be a valid ISO 8601 date',
        },
      },
      fees: {
        in: ['body'],
        optional: true,
        isObject: {
          errorMessage: 'Fees must be an object',
        },
      },
      gatewayResponse: {
        in: ['body'],
        optional: true,
        isObject: {
          errorMessage: 'Gateway response must be an object',
        },
      },
      billingAddress: {
        in: ['body'],
        optional: true,
        isObject: {
          errorMessage: 'Billing address must be an object',
        },
      },
      metadata: {
        in: ['body'],
        optional: true,
        isObject: {
          errorMessage: 'Metadata must be an object',
        },
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const refundTransactionValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      transactionId: {
        in: ['params'],
        isMongoId: { errorMessage: 'Invalid transaction ID format' },
        notEmpty: { errorMessage: 'Transaction ID is required' },
      },
      reason: {
        in: ['body'],
        notEmpty: { errorMessage: 'Refund reason is required' },
        isLength: { options: { min: 10, max: 500 }, errorMessage: 'Reason must be between 10 and 500 characters' },
        trim: true,
      },
      amount: {
        in: ['body'],
        optional: true,
        isFloat: { options: { min: 0.01 }, errorMessage: 'Amount must be greater than 0' },
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const TransactionValidator = {
  validatePagination,
  validateTransactionQueryParams,
  validateTransactionId,
  validateUpdateTransaction,
  refundTransactionValidator,
};

export default TransactionValidator;
