import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const createSubCategoryValidator = [
  checkSchema({
    name: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Name is required and should be a string',
    },
    categoryId: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Category ID is required and should be a string',
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

const updateSubCategoryValidator = [
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
    },
    name: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Name is required and should be a string',
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

const deleteSubCategoryValidator = [
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
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

const SubCategoryValidator = {
  createSubCategoryValidator,
  updateSubCategoryValidator,
  deleteSubCategoryValidator,
};

export default SubCategoryValidator;
