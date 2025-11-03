import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { checkSchema, validationResult } from 'express-validator';

export const categorySlugValidators = (): RequestHandler[] => [
  // Cast the validation chain to RequestHandler for Express typings compatibility
  checkSchema({
    slug: { in: ['params'], isString: true, trim: true },
  }) as unknown as RequestHandler,
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation error', errors: errors.array() });
    }
    next();
  },
];
