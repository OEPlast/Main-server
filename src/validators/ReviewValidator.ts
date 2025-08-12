import { Request, Response, NextFunction } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const validateCreateReview = [
  checkSchema({
    productId: {
      in: ['body'],
      isMongoId: true,
      errorMessage: 'Invalid product ID',
    },
    rating: {
      in: ['body'],
      isInt: {
        options: { min: 1, max: 5 },
      },
      errorMessage: 'Rating must be between 1 and 5',
    },
    comment: {
      in: ['body'],
      isString: true,
      trim: true,
      isLength: {
        options: { min: 10, max: 1000 },
      },
      errorMessage: 'Comment must be between 10 and 1000 characters',
    },
    title: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      isLength: {
        options: { max: 100 },
      },
      errorMessage: 'Title must be less than 100 characters',
    },
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const validateUpdateReview = [
  checkSchema({
    reviewId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Invalid review ID',
    },
    rating: {
      in: ['body'],
      optional: true,
      isInt: {
        options: { min: 1, max: 5 },
      },
      errorMessage: 'Rating must be between 1 and 5',
    },
    comment: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      isLength: {
        options: { min: 10, max: 1000 },
      },
      errorMessage: 'Comment must be between 10 and 1000 characters',
    },
    title: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      isLength: {
        options: { max: 100 },
      },
      errorMessage: 'Title must be less than 100 characters',
    },
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const validateReviewId = [
  checkSchema({
    reviewId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Invalid review ID',
    },
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const validateProductReviewsQuery = [
  checkSchema({
    productId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Invalid product ID',
    },
    page: {
      in: ['query'],
      isInt: {
        options: { min: 1 },
      },
      optional: true,
      toInt: true,
      errorMessage: 'Page must be a positive integer',
    },
    limit: {
      in: ['query'],
      isInt: {
        options: { min: 1, max: 100 },
      },
      optional: true,
      toInt: true,
      errorMessage: 'Limit must be between 1 and 100',
    },
    rating: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1, max: 5 },
      },
      toInt: true,
      errorMessage: 'Rating filter must be between 1 and 5',
    },
    sortBy: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['createdAt', 'rating', 'helpful']],
      },
      errorMessage: 'Sort by must be one of: createdAt, rating, helpful',
    },
    sortOrder: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['asc', 'desc']],
      },
      errorMessage: 'Sort order must be either asc or desc',
    },
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const validateReviewHelpful = [
  checkSchema({
    reviewId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Invalid review ID',
    },
    helpful: {
      in: ['body'],
      isBoolean: true,
      errorMessage: 'Helpful must be a boolean value',
    },
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

export default {
  validateCreateReview,
  validateUpdateReview,
  validateReviewId,
  validateProductReviewsQuery,
  validateReviewHelpful,
};
