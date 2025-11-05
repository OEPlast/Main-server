import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const listQueryValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    page: { in: ['query'], optional: true, isInt: { options: { min: 1 } }, toInt: true },
    limit: { in: ['query'], optional: true, isInt: { options: { min: 1, max: 100 } }, toInt: true },
    q: { in: ['query'], optional: true, isString: true, trim: true },
  }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const campaignIdWithProductsQueryValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    campaignId: { in: ['params'], isMongoId: true, errorMessage: 'campaignId must be a valid id' },
    page: { in: ['query'], optional: true, isInt: { options: { min: 1 } }, toInt: true },
    limit: { in: ['query'], optional: true, isInt: { options: { min: 1, max: 100 } }, toInt: true },
  }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const slugWithProductsQueryValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    slug: {
      in: ['params'],
      isString: true,
      trim: true,
      matches: {
        options: [/^[a-z0-9-]+$/],
        errorMessage: 'slug may only contain lowercase letters, numbers, and hyphens',
      },
    },
    page: { in: ['query'], optional: true, isInt: { options: { min: 1 } }, toInt: true },
    limit: { in: ['query'], optional: true, isInt: { options: { min: 1, max: 100 } }, toInt: true },
    minPrice: { in: ['query'], optional: true, isFloat: { options: { min: 0 } }, toFloat: true },
    maxPrice: { in: ['query'], optional: true, isFloat: { options: { min: 0 } }, toFloat: true },
    inStock: { in: ['query'], optional: true, isBoolean: true, toBoolean: true },
    packSize: { in: ['query'], optional: true, isString: true, trim: true },
    sort: { in: ['query'], optional: true, isString: true, trim: true },
    tags: { in: ['query'], optional: true },
    attributes: { in: ['query'], optional: true },
  }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

export default { listQueryValidator, campaignIdWithProductsQueryValidator, slugWithProductsQueryValidator };
