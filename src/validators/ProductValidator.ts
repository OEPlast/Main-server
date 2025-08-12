import { Request, Response, NextFunction } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const validateProductId = [
  checkSchema({
    productId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Invalid product ID',
    },
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const validateProductQuery = [
  checkSchema({
    page: {
      in: ['query'],
      isInt: {
        options: { min: 1 },
      },
      optional: true,
      toInt: true,
      errorMessage: 'Page must be a positive integer',
    },
    limit: {
      in: ['query'],
      isInt: {
        options: { min: 1, max: 100 },
      },
      optional: true,
      toInt: true,
      errorMessage: 'Limit must be between 1 and 100',
    },
    category: {
      in: ['query'],
      optional: true,
      isMongoId: true,
      errorMessage: 'Category must be a valid MongoDB ID',
    },
    subcategory: {
      in: ['query'],
      optional: true,
      isMongoId: true,
      errorMessage: 'Subcategory must be a valid MongoDB ID',
    },
    search: {
      in: ['query'],
      optional: true,
      isString: true,
      trim: true,
      isLength: {
        options: { min: 2 },
      },
      errorMessage: 'Search query must be at least 2 characters',
    },
    minPrice: {
      in: ['query'],
      optional: true,
      isFloat: {
        options: { min: 0 },
      },
      toFloat: true,
      errorMessage: 'Minimum price must be a positive number',
    },
    maxPrice: {
      in: ['query'],
      optional: true,
      isFloat: {
        options: { min: 0 },
      },
      toFloat: true,
      errorMessage: 'Maximum price must be a positive number',
    },
    sortBy: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['price', 'name', 'createdAt', 'rating', 'sales']],
      },
      errorMessage: 'Sort by must be one of: price, name, createdAt, rating, sales',
    },
    sortOrder: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['asc', 'desc']],
      },
      errorMessage: 'Sort order must be either asc or desc',
    },
    availability: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['in-stock', 'out-of-stock', 'low-stock']],
      },
      errorMessage: 'Availability must be one of: in-stock, out-of-stock, low-stock',
    },
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const validateSearchQuery = [
  checkSchema({
    q: {
      in: ['query'],
      isString: true,
      trim: true,
      isLength: {
        options: { min: 2 },
      },
      errorMessage: 'Search query must be at least 2 characters',
    },
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

export default {
  validateProductId,
  validateProductQuery,
  validateSearchQuery,
};
