import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const productIdValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Product ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const reviewIdValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Review ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const addReplyValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateReplyValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const paginationValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const ReviewValidator = {
  productIdValidator,
  reviewIdValidator,
  addReplyValidator,
  updateReplyValidator,
  paginationValidator,
};

export default ReviewValidator;
