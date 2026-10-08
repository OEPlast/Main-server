import { body, query } from 'express-validator';
import { validate } from '@/middleware/validate';

export const MAX_IMPORT_BATCH = 10;

const listValidator = [
  query('after').optional().isInt({ min: 0 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  validate,
];

const importValidator = [
  body('items')
    .isArray({ min: 1, max: MAX_IMPORT_BATCH })
    .withMessage(`items must be an array of 1 to ${MAX_IMPORT_BATCH} products`),
  body('items.*.vyluxId').isInt({ min: 1 }).withMessage('vyluxId must be a positive integer').toInt(),
  body('items.*.categoryId').isMongoId().withMessage('categoryId must be a valid category id'),
  body('items.*.price').isFloat({ gt: 0 }).withMessage('price must be greater than 0').toFloat(),
  body('items.*.name').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('items.*.description').optional().isString().trim(),
  validate,
];

const VyluxValidator = { listValidator, importValidator };
export default VyluxValidator;
