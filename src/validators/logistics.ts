import { body } from 'express-validator';

export const quoteValidator = [
  body('productId').isString().trim().notEmpty(),
  body('quantity').optional().isInt({ min: 1 }),
  body('destination.countryCode').isString().trim().isLength({ min: 2, max: 3 }),
  body('destination.stateCode').optional().isString().trim(),
  body('destination.cityName').optional().isString().trim(),
  body('destination.lgaName').optional().isString().trim(),
];
