import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

//order validator for user

const validateOrderPlacement = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    products: {
      in: ['body'],
      isArray: {
        options: { min: 1 },
        errorMessage: 'Products must be an array with at least one item.',
      },
    },
    'products.*.product': {
      in: ['body'],
      isMongoId: true,
      errorMessage: 'Each product must have a valid MongoDB ID.',
    },
    'products.*.qty': {
      in: ['body'],
      isInt: {
        options: { min: 1 },
        errorMessage: 'Quantity must be at least 1.',
      },
    },
    shippingAddress: {
      in: ['body'],
      notEmpty: true,
      errorMessage: 'Shipping address is required.',
    },
    paymentMethod: {
      in: ['body'],
      notEmpty: true,
      errorMessage: 'Payment method is required.',
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateOrderId = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Order ID must be a valid MongoDB ID.',
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const OrderValidator = {
  validateOrderPlacement,
  validateOrderId,
};

export default OrderValidator;
