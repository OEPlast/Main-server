import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const updateUserRoleValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    userId: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'User ID is required and should be a string',
    },
    role: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Role is required and should be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const RoleValidator = {
  updateUserRoleValidator,
};

export default RoleValidator;
