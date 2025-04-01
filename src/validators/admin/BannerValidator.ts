import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const createBannerValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    name: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Name is required and should be a string',
      isLength: {
        options: { min: 2, max: 100 },
        errorMessage: 'Name should be between 2 and 100 characters',
      },
    },
    imageUrl: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      isURL: true,
      errorMessage: 'A valid image URL is required',
    },
    pageLink: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      custom: {
        options: (value) => {
          if (!/^\/.*/.test(value)) {
            throw new Error('Page link must start with "/"');
          }
          return true;
        },
      },
      errorMessage: 'Page link is required and must start with "/"',
    },
    active: {
      in: ['body'],
      isBoolean: true,
      optional: true,
      errorMessage: 'Active status should be a boolean',
    },
    category: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      custom: {
        options: (value) => {
          const validCategories = ['A', 'B', 'C', 'D', 'E'];
          if (!validCategories.includes(value)) {
            throw new Error('Category must be one of: A, B, C, D, or E');
          }
          return true;
        },
      },
      errorMessage: 'Category is required and must be one of: A, B, C, D, or E',
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateBannerValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    name: {
      in: ['body'],
      isString: true,
      optional: true,
      isLength: {
        options: { min: 2, max: 100 },
        errorMessage: 'Name should be between 2 and 100 characters',
      },
    },
    imageUrl: {
      in: ['body'],
      isString: true,
      optional: true,
      isURL: true,
      errorMessage: 'Image URL must be a valid URL',
    },
    pageLink: {
      in: ['body'],
      isString: true,
      optional: true,
      custom: {
        options: (value) => {
          if (value && !/^\/.*/.test(value)) {
            throw new Error('Page link must start with "/"');
          }
          return true;
        },
      },
    },
    active: {
      in: ['body'],
      isBoolean: true,
      optional: true,
      errorMessage: 'Active status should be a boolean',
    },
    category: {
      in: ['body'],
      isString: true,
      optional: true,
      custom: {
        options: (value) => {
          if (value) {
            const validCategories = ['A', 'B', 'C', 'D', 'E'];
            if (!validCategories.includes(value)) {
              throw new Error('Category must be one of: A, B, C, D, or E');
            }
          }
          return true;
        },
      },
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const deleteBannerValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const getBannerValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const toggleBannerActiveValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const Admin_BannerValidator = {
  createBannerValidator,
  updateBannerValidator,
  deleteBannerValidator,
  getBannerValidator,
  toggleBannerActiveValidator,
};

export default Admin_BannerValidator;
