import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

export const createAccount = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    username: {
      errorMessage: 'Invalid username',
      isEmail: true,
    },
    password: {
      isLength: {
        options: { min: 8 },
        errorMessage: 'Password should be at least 8 chars',
      },
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
