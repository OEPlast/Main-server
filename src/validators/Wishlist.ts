import { checkSchema, validationResult } from 'express-validator';
import type { NextFunction, Request, Response } from 'express';

// Validator for adding an item to the wishlist
const addToWishlist = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    product: {
      isString: true,
      notEmpty: true,
      errorMessage: 'Product Id is required and should be a string',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for removing an item from the wishlist
const removeFromWishlist = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: 'params',
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for getting all wishlist items with pagination
const getAllWishlists = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    page: {
      optional: true,
      isNumeric: true,
      errorMessage: 'Page should be a number',
    },
    limit: {
      optional: true,
      isNumeric: true,
      errorMessage: 'Limit should be a number',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const WishlistValidator = {
  addToWishlist,
  removeFromWishlist,
  getAllWishlists,
};

export default WishlistValidator;
