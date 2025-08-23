import { body, oneOf } from 'express-validator';

export const quoteValidator = [
  body('productId').isString().trim().notEmpty(),
  body('quantity').optional().isInt({ min: 1 }),
  body('destination.countryName').isString().trim(),
  body('destination.stateCode').optional().isString().trim(),
  body('destination.cityName').optional().isString().trim(),
  body('destination.lgaName').optional().isString().trim(),
];

// Validator for calculating flat cart shipping with size/weight considerations
export const flatCartShippingValidator = [
  // Accept either an array of items OR productId+quantity
  oneOf(
    [
      [
        body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
        body('items.*.productId').isString().trim().notEmpty(),
        body('items.*.quantity').isInt({ min: 1 }),
      ],
      [body('productId').isString().trim().notEmpty(), body('quantity').optional().isInt({ min: 1 })],
    ],
    { message: 'Provide either items[] or productId/quantity' }
  ),
  body('destination.countryName').isString().trim().notEmpty(),
  body('destination.stateCode').isString().trim().notEmpty(),
  body('destination.lgaName').isString().trim().notEmpty(),
];
