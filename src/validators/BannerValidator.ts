import { Request, Response, NextFunction } from 'express';
import { checkExact, checkSchema, validationResult } from 'express-validator';

const validateBannerQuery = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
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
    status: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['active', 'inactive']],
      },
      errorMessage: 'Status must be either active or inactive',
    },
  }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateBannerId = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: {
        in: ['params'],
        isMongoId: true,
        errorMessage: 'Invalid banner ID',
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const BannerValidator = {
  validateBannerQuery,
  validateBannerId,
};

export default BannerValidator;
