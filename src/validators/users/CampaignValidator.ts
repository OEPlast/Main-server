import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const listQueryValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    page: { in: ['query'], optional: true, isInt: { options: { min: 1 } }, toInt: true },
    limit: { in: ['query'], optional: true, isInt: { options: { min: 1, max: 100 } }, toInt: true },
    q: { in: ['query'], optional: true, isString: true, trim: true },
  }).run(req);

  validationResult(req).isEmpty()
    ? next()
    : res.status(400).json({ message: 'Validation failed', data: validationResult(req).array(), code: 400 });
};

const campaignIdWithProductsQueryValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    campaignId: { in: ['params'], isMongoId: true, errorMessage: 'campaignId must be a valid id' },
    page: { in: ['query'], optional: true, isInt: { options: { min: 1 } }, toInt: true },
    limit: { in: ['query'], optional: true, isInt: { options: { min: 1, max: 100 } }, toInt: true },
  }).run(req);

  validationResult(req).isEmpty()
    ? next()
    : res.status(400).json({ message: 'Validation failed', data: validationResult(req).array(), code: 400 });
};

export default { listQueryValidator, campaignIdWithProductsQueryValidator };
