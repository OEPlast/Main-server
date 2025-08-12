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

export const setStockValidator = [...productIdParam, body('stock').isInt({ min: 0 }).withMessage('stock must be >= 0')];

export const bulkAdjustValidator = [
  body().isArray({ min: 1 }).withMessage('updates array required'),
  body('*.productId').isMongoId().withMessage('Invalid productId'),
  body('*.delta').isInt().withMessage('delta must be integer'),
];
