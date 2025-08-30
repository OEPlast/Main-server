import { body, param, query } from 'express-validator';

export const listValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('q').optional().isString(),
  query('status').optional().isIn(['active', 'inactive', 'archived']),
  query('lowOnly').optional().isBoolean(),
];

export const productIdParam = [param('productId').isMongoId().withMessage('Invalid productId')];

export const setThresholdValidator = [
  ...productIdParam,
  body('threshold').isInt({ min: 0 }).withMessage('threshold must be >= 0'),
];

// Accept either total stock or an array of variant updates, or both (when both provided, service ensures totals match)
export const setStockValidator = [
  ...productIdParam,
  body('stock').optional().isInt({ min: 0 }).withMessage('stock must be >= 0'),
  body('variants').optional().isArray().withMessage('variants must be an array of { attributeName, childName, stock }'),
  body('variants.*.attributeName').optional().isString().notEmpty(),
  body('variants.*.childName').optional().isString().notEmpty(),
  body('variants.*.stock').optional().isInt({ min: 0 }).withMessage('variant stock must be >= 0'),
  // Custom validator to ensure at least one of stock or variants is provided
  body('*').custom((_, { req }) => {
    if (req.body.stock == null && (!Array.isArray(req.body.variants) || req.body.variants.length === 0)) {
      throw new Error('Provide either stock or variants to update');
    }
    return true;
  }),
];
