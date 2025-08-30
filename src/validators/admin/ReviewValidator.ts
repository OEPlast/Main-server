import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validate review filters for getAllReviews
const validateReviewFilters = [
  checkSchema({
    page: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1 },
      },
      toInt: true,
      errorMessage: 'Page must be a positive integer',
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1, max: 100 },
      },
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
      errorMessage: 'Rating must be between 1 and 5',
    },
    isApproved: {
      in: ['query'],
      optional: true,
      isBoolean: true,
      toBoolean: true,
      errorMessage: 'isApproved must be a boolean value',
    },
    productId: {
      in: ['query'],
      optional: true,
      isMongoId: true,
      errorMessage: 'Product ID must be a valid MongoDB ObjectId',
    },
    userId: {
      in: ['query'],
      optional: true,
      isMongoId: true,
      errorMessage: 'User ID must be a valid MongoDB ObjectId',
    },
    startDate: {
      in: ['query'],
      optional: true,
      isISO8601: true,
      errorMessage: 'Start date must be a valid ISO 8601 date',
    },
    endDate: {
      in: ['query'],
      optional: true,
      isISO8601: true,
      errorMessage: 'End date must be a valid ISO 8601 date',
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
  handleValidationErrors,
];

// Validate review ID parameter
const validateReviewId = [
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ObjectId',
    },
  }),
  handleValidationErrors,
];

// Validate product ID parameter
const validateProductId = [
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Product ID must be a valid MongoDB ObjectId',
    },
  }),
  handleValidationErrors,
];

// Validate user ID parameter
const validateUserId = [
  checkSchema({
    userId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'User ID must be a valid MongoDB ObjectId',
    },
  }),
  handleValidationErrors,
];

// Validate moderation request
const validateModeration = [
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ObjectId',
    },
    isApproved: {
      in: ['body'],
      isBoolean: true,
      errorMessage: 'isApproved must be a boolean value',
    },
    moderationNote: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      isLength: {
        options: { max: 500 },
      },
      errorMessage: 'Moderation note must be a string with maximum 500 characters',
    },
  }),
  handleValidationErrors,
];

// Validate review update
const validateReviewUpdate = [
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ObjectId',
    },
    review: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      isLength: {
        options: { min: 10, max: 1000 },
      },
      errorMessage: 'Review must be between 10 and 1000 characters',
    },
    rating: {
      in: ['body'],
      optional: true,
      isInt: {
        options: { min: 1, max: 5 },
      },
      errorMessage: 'Rating must be between 1 and 5',
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
    moderationNote: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      isLength: {
        options: { max: 500 },
      },
      errorMessage: 'Moderation note must be a string with maximum 500 characters',
    },
  }),
  handleValidationErrors,
];

// Validate mood analytics request
const validateMoodAnalytics = [
  checkSchema({
    startDate: {
      in: ['query'],
      isISO8601: true,
      errorMessage: 'Start date is required and must be a valid ISO 8601 date',
    },
    endDate: {
      in: ['query'],
      isISO8601: true,
      errorMessage: 'End date is required and must be a valid ISO 8601 date',
    },
    productId: {
      in: ['query'],
      optional: true,
      isMongoId: true,
      errorMessage: 'Product ID must be a valid MongoDB ObjectId',
    },
    categoryId: {
      in: ['query'],
      optional: true,
      isMongoId: true,
      errorMessage: 'Category ID must be a valid MongoDB ObjectId',
    },
  }),
  handleValidationErrors,
];

// Validate add reply request
const validateAddReply = [
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ObjectId',
    },
    reply: {
      in: ['body'],
      isString: true,
      trim: true,
      isLength: {
        options: { min: 1, max: 1000 },
      },
      errorMessage: 'Reply is required and must be between 1 and 1000 characters',
    },
  }),
  handleValidationErrors,
];

// Validate update reply request
const validateUpdateReply = [
  checkSchema({
    reviewId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ObjectId',
    },
    replyId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Reply ID must be a valid MongoDB ObjectId',
    },
    reply: {
      in: ['body'],
      isString: true,
      trim: true,
      isLength: {
        options: { min: 1, max: 1000 },
      },
      errorMessage: 'Reply is required and must be between 1 and 1000 characters',
    },
  }),
  handleValidationErrors,
];

// Validate delete reply request
const validateDeleteReply = [
  checkSchema({
    reviewId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ObjectId',
    },
    replyId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Reply ID must be a valid MongoDB ObjectId',
    },
  }),
  handleValidationErrors,
];

// Legacy validators for backward compatibility
const productIdValidator = (req: Request, res: Response, next: NextFunction) => {
  const schema = checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Product ID must be a valid MongoDB ID',
    },
  });
  
  schema[0](req, res, (err) => {
    if (err) return next(err);
    handleValidationErrors(req, res, next);
  });
};

const reviewIdValidator = (req: Request, res: Response, next: NextFunction) => {
  const schema = checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ID',
    },
  });
  
  schema[0](req, res, (err) => {
    if (err) return next(err);
    handleValidationErrors(req, res, next);
  });
};

const addReplyValidator = (req: Request, res: Response, next: NextFunction) => {
  const schema = checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ID',
    },
    reply: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      isLength: {
        options: { min: 1, max: 1000 },
        errorMessage: 'Reply must be between 1 and 1000 characters',
      },
      errorMessage: 'Reply is required and should be a string',
    },
  });
  
  schema[0](req, res, (err) => {
    if (err) return next(err);
    handleValidationErrors(req, res, next);
  });
};

const updateReplyValidator = (req: Request, res: Response, next: NextFunction) => {
  const schema = checkSchema({
    reviewId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ID',
    },
    replyId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Reply ID must be a valid MongoDB ID',
    },
    reply: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      isLength: {
        options: { min: 1, max: 1000 },
        errorMessage: 'Reply must be between 1 and 1000 characters',
      },
      errorMessage: 'Reply is required and should be a string',
    },
  });
  
  schema[0](req, res, (err) => {
    if (err) return next(err);
    handleValidationErrors(req, res, next);
  });
};

const paginationValidator = (req: Request, res: Response, next: NextFunction) => {
  const schema = checkSchema({
    page: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1 },
        errorMessage: 'Page must be a positive integer',
      },
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1, max: 100 },
        errorMessage: 'Limit must be between 1 and 100',
      },
    },
    rating: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1, max: 5 },
        errorMessage: 'Rating must be between 1 and 5',
      },
    },
  });
  
  schema[0](req, res, (err) => {
    if (err) return next(err);
    handleValidationErrors(req, res, next);
  });
};

const ReviewValidator = {
  // New comprehensive validators
  validateReviewFilters,
  validateReviewId,
  validateProductId,
  validateUserId,
  validateModeration,
  validateReviewUpdate,
  validateMoodAnalytics,
  validateAddReply,
  validateUpdateReply,
  validateDeleteReply,
  
  // Legacy validators for backward compatibility
  productIdValidator,
  reviewIdValidator,
  addReplyValidator,
  updateReplyValidator,
  paginationValidator,
};

export default ReviewValidator;
