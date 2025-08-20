import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, validationResult } from 'express-validator';

const createCategoryValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
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
      banner: {
        in: ['body'],
        isString: true,
        optional: true,
        errorMessage: 'Banner should be a string URL',
      },
      parent: {
        in: ['body'],
        isArray: true,
        optional: true,
        errorMessage: 'Parent must be an array of strings',
      },
      'parent.*': {
        in: ['body'],
        isMongoId: true,
        errorMessage: 'Each parent value must be a id',
      },
    })
  ).run(req);
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
    banner: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Banner should be a string URL',
    },
    parent: {
      in: ['body'],
      isArray: true,
      optional: true,
      errorMessage: 'Parent is an array of parents',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const listCategoriesValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    page: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      toInt: true,
      errorMessage: 'page must be an integer >= 1',
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1, max: 100 } },
      toInt: true,
      errorMessage: 'limit must be an integer between 1 and 100',
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
  listCategoriesValidator,
};

export default CategoryValidator;
