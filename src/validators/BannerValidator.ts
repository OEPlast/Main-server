import { Request, Response, NextFunction } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const validateBannerQuery = [
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
    type: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['hero', 'promotion', 'category', 'product']],
      },
      errorMessage: 'Type must be one of: hero, promotion, category, product',
    },
    status: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['active', 'inactive']],
      },
      errorMessage: 'Status must be either active or inactive',
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

const validateBannerId = [
  checkSchema({
    bannerId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Invalid banner ID',
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
  validateBannerQuery,
  validateBannerId,
};
