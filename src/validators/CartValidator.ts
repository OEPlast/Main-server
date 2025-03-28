import { checkSchema, validationResult } from 'express-validator';
import type { NextFunction, Request, Response } from 'express';

// Validator for adding an item to the cart
const addToCart = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    productId: {
      isString: true,
      notEmpty: true,
      errorMessage: 'Product ID is required and should be a string',
    },
    qty: {
      isInt: { options: { min: 1 } },
      errorMessage: 'Quantity must be at least 1',
    },
    attributes: {
      isArray: true,
      errorMessage: 'Attributes must be an array',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for updating an item in the cart
const updateCartItem = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    productId: {
      isString: true,
      notEmpty: true,
      errorMessage: 'Product ID is required and should be a string',
    },
    qty: {
      isInt: { options: { min: 1 } },
      errorMessage: 'Quantity must be at least 1',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const CartValidator = {
  addToCart,
  updateCartItem,
};

export default CartValidator;
