import { checkExact, checkSchema, validationResult } from 'express-validator';
import type { NextFunction, Request, Response } from 'express';

// Validator for adding an item to the cart
const addToCart = async (req: Request, res: Response, next: NextFunction) => {
await checkExact(
  checkSchema({
    productId: {
      isString: true,
      notEmpty: true,
      errorMessage: 'Product ID is required and should be a string',
    },
    qty: {
      isInt: { options: { min: 1, max: 99 } },
      errorMessage: 'Quantity must be between 1 and 99',
    },
    attributes: {
      isArray: true,
      errorMessage: 'Attributes must be an array',
      optional: { options: { nullable: true } },
    },
    'attributes.*.name': {
      isString: true,
      notEmpty: true,
      errorMessage: 'Attribute name is required',
    },
    'attributes.*.value': {
      isString: true,
      notEmpty: true,
      errorMessage: 'Attribute value is required',
    },
  })).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for updating a cart item
const updateCartItem = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      qty: {
        in: ['body'],
        isInt: { options: { min: 1, max: 9999 } },
        optional: true,
        errorMessage: 'Quantity must be between 1 and 9999',
    },
      itemId: {
        in: ['params'],
        isMongoId: true,
        errorMessage: 'Valid item ID is required',
    },
    // selectedAttributes: {
    //   isArray: true,
    //   optional: { options: { nullable: true } },
    //   errorMessage: 'Selected attributes must be an array',
    // },
    // 'selectedAttributes.*.name': {
    //   isString: true,
    //   notEmpty: true,
    //   errorMessage: 'Attribute name is required',
    // },
    // 'selectedAttributes.*.value': {
    //   isString: true,
    //   notEmpty: true,
    //   errorMessage: 'Attribute value is required',
    // },
  })).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for applying coupon
const applyCoupon = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    couponCode: {
      isString: true,
      notEmpty: true,
      trim: true,
      isLength: { options: { min: 4, max: 12 } },
      errorMessage: 'Coupon code must be 4-12 characters long',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for removing item (itemId param)
const removeItem = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      itemId: {
        in: ['params'],
        isMongoId: true,
        errorMessage: 'Valid item ID is required',
    },
  })).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for removing coupon (couponId param)
const removeCoupon = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      couponId: {
        in: ['params'],
        isMongoId: true,
        errorMessage: 'Valid coupon ID is required',
    },
  })).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const CartValidator = {
  addToCart,
  updateCartItem,
  applyCoupon,
  removeItem,
  removeCoupon,
};

export default CartValidator;
