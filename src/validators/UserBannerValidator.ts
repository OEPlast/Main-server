import { Request, Response, NextFunction } from 'express';
import { checkSchema, validationResult } from 'express-validator';


/**
 * Validate query parameters for getting banners
 * Supports optional 'category' parameter (A, B, C, D, or E)
 */
const validateGetBannersQuery = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    category: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['A', 'B', 'C', 'D', 'E']],
        errorMessage: 'Category must be one of: A, B, C, D, E',
      },
      trim: true,
      toUpperCase: true,
    },
  }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array() 
    });
  }

  next();
};

const UserBannerValidator = {
  validateGetBannersQuery,
};

export default UserBannerValidator;
