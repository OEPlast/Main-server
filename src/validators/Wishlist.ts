import { checkSchema, validationResult } from 'express-validator';
import type { NextFunction, Request, Response } from 'express';

// Validator for adding an item to the wishlist
const addToWishlist = async (req: Request, res: Response, next: NextFunction) => {
  const chains = checkSchema({
    product: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Product Id is required and should be a string',
      trim: true,
    },
  });
  await Promise.all(chains.map((c) => c.run(req)));

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

// Validator for removing an item from the wishlist
const removeFromWishlist = async (req: Request, res: Response, next: NextFunction) => {
  const chains = checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
      trim: true,
    },
  });
  await Promise.all(chains.map((c) => c.run(req)));

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

// Validator for getting all wishlist items with pagination
const getAllWishlists = async (req: Request, res: Response, next: NextFunction) => {
  const chains = checkSchema({
    page: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      toInt: true,
      errorMessage: 'Page should be a positive integer',
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1, max: 100 } },
      toInt: true,
      errorMessage: 'Limit should be a positive integer between 1 and 100',
    },
  });
  await Promise.all(chains.map((c) => c.run(req)));

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

const WishlistValidator = {
  addToWishlist,
  removeFromWishlist,
  getAllWishlists,
};

export default WishlistValidator;
