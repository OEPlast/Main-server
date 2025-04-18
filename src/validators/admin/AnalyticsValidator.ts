import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

export const validateAnalyticsQuery = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    from: {
      in: ['query'],
      isISO8601: true,
      toDate: true,
      errorMessage: 'The "from" query parameter is required and must be a valid ISO8601 date.',
    },
    to: {
      in: ['query'],
      isISO8601: true,
      toDate: true,
      errorMessage: 'The "to" query parameter is required and must be a valid ISO8601 date.',
    },
    page: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      toInt: true,
      errorMessage: 'The "page" query parameter must be a positive integer.',
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      toInt: true,
      errorMessage: 'The "limit" query parameter must be a positive integer.',
    },
    metric: {
      in: ['query'],
      optional: true,
      isString: true,
      errorMessage: 'The "metric" query parameter must be a string.',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  next();
};
