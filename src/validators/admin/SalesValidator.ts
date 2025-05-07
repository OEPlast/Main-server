import { body, param } from 'express-validator';

export const validateSalesCreate = [
  body('title').isString().notEmpty(),
  body('product').isMongoId(),
  body('createdBy').isMongoId(),
  body('updatedBy').isMongoId(),
  body('type').optional().isIn(['Flash', 'Limited', 'Normal']),
  body('limit').optional().isInt({ min: 1 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('variants').optional().isArray(),
];

export const validateSalesUpdate = [
  param('id').isMongoId(),
  body('title').optional().isString(),
  body('product').optional().isMongoId(),
  body('updatedBy').optional().isMongoId(),
  body('type').optional().isIn(['Flash', 'Limited', 'Normal']),
  body('limit').optional().isInt({ min: 1 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('variants').optional().isArray(),
];

export const validateSalesId = [param('id').isMongoId()];

export const validateSalesType = [param('type').isIn(['Flash', 'Limited', 'Normal'])];

export const validateSalesVariantUpdate = [
  param('id').isMongoId(),
  body('variantIndex').isInt({ min: 0 }),
  body('variantData').isObject(),
];
