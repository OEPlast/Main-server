import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { checkSchema, validationResult } from 'express-validator';

export const couponCodeValidators = (): RequestHandler[] => [
  checkSchema({
    code: {
      in: ['params'],
      isString: true,
      trim: true,
      isLength: {
        options: { min: 4, max: 20 },
        errorMessage: 'Coupon code must be between 4 and 20 characters',
      },
    },
  }) as unknown as RequestHandler,
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation error', errors: errors.array() });
    }
    next();
  },
];

export const validateCouponValidators = (): RequestHandler[] => [
  checkSchema({
    code: {
      in: ['body'],
      isString: true,
      trim: true,
      isLength: {
        options: { min: 4, max: 20 },
        errorMessage: 'Coupon code must be between 4 and 20 characters',
      },
    },
    orderTotal: {
      in: ['body'],
      isNumeric: true,
      toFloat: true,
      custom: {
        options: (value: number) => value >= 0,
        errorMessage: 'Order total must be a positive number',
      },
    },
    productIds: {
      in: ['body'],
      optional: true,
      isArray: {
        errorMessage: 'Product IDs must be an array',
      },
    },
    categoryIds: {
      in: ['body'],
      optional: true,
      isArray: {
        errorMessage: 'Category IDs must be an array',
      },
    },
  }) as unknown as RequestHandler,
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation error', errors: errors.array() });
    }
    next();
  },
];
