import { Request, Response, NextFunction } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const validatePagination = [
  checkSchema({
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
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const validateCategoryId = [
  checkSchema({
    categoryId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Invalid category ID',
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

const validateSubcategoryId = [
  checkSchema({
    subcategoryId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Invalid subcategory ID',
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

const validateCategoryQuery = [
  checkSchema({
    status: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['active', 'inactive']],
      },
      errorMessage: 'Status must be either active or inactive',
    },
    parent: {
      in: ['query'],
      optional: true,
      isMongoId: true,
      errorMessage: 'Parent must be a valid MongoDB ID',
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
  validatePagination,
  validateCategoryId,
  validateSubcategoryId,
  validateCategoryQuery,
};
