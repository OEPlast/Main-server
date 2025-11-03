import { Request, Response, NextFunction } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const validateProductId = [
  checkSchema({
    id: {
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
        options: { min: 1, max: 150 },
      },
      optional: true,
      toInt: true,
      errorMessage: 'Limit must be between 1 and 150',
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
    brand: {
      in: ['query'],
      optional: true,
      isString: true,
      trim: true,
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
    specKey: {
      in: ['query'],
      optional: true,
      isString: true,
      trim: true,
    },
    specValue: {
      in: ['query'],
      optional: true,
      isString: true,
      trim: true,
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

const validateCategorySlug = [
  checkSchema({
    slug: { in: ['params'], isString: true, trim: true, errorMessage: 'Invalid category slug' },
    page: { in: ['query'], optional: true, isInt: { options: { min: 1 } }, toInt: true },
    limit: { in: ['query'], optional: true, isInt: { options: { min: 1, max: 100 } }, toInt: true },
    sort: {
      in: ['query'],
      optional: true,
      // comma-separated string or array is handled in controller; here ensure values are within allowed set when present
      custom: {
        options: (value) => {
          const arr = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
          const allowed = [
            'alphabetical',
            'newest',
            'price_asc',
            'price_desc',
            'popular',
            'stock',
            'order_frequency',
            'rating',
          ];
          return arr.every((v: string) => allowed.includes(v.trim()));
        },
      },
    },
    minPrice: { in: ['query'], optional: true, isFloat: { options: { min: 0 } }, toFloat: true },
    maxPrice: { in: ['query'], optional: true, isFloat: { options: { min: 0 } }, toFloat: true },
    subcategory: { in: ['query'], optional: true, isString: true, trim: true },
    tags: { in: ['query'], optional: true },
    packSize: { in: ['query'], optional: true, isString: true, trim: true },
    inStock: { in: ['query'], optional: true, isBoolean: true, toBoolean: true },
    includeStats: { in: ['query'], optional: true, isBoolean: true, toBoolean: true },
    // attributes/specs can be array or comma-separated "name:value" pairs
    attributes: { in: ['query'], optional: true },
    specs: { in: ['query'], optional: true },
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
  validateCategorySlug,
};

// Additional validator for product slug
export const validateProductSlug = [
  checkSchema({
    slug: { in: ['params'], isString: true, trim: true, isLength: { options: { min: 1 } } },
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];
