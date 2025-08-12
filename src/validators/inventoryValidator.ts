import { body, param } from 'express-validator';

export const productIdParam = [param('productId').isMongoId().withMessage('Invalid productId')];

export const adjustStockValidator = [...productIdParam, body('delta').isInt().withMessage('delta must be an integer')];

export const reserveValidator = [
  ...productIdParam,
  body('quantity').isInt({ min: 1 }).withMessage('quantity must be >= 1'),
];
