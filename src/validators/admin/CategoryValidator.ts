import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const createCategoryValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    name: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Category name is required and should be a string',
    },
    description: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Description should be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateCategoryValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    name: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Category name should be a string',
    },
    description: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Description should be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const CategoryValidator = {
  createCategoryValidator,
  updateCategoryValidator,
};

export default CategoryValidator;
