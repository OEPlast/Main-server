import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const createCampaignValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    name: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Campaign name is required and should be a string',
    },
    description: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Description should be a string',
    },
    startDate: {
      in: ['body'],
      isISO8601: true,
      errorMessage: 'Start date must be a valid ISO 8601 date',
    },
    endDate: {
      in: ['body'],
      isISO8601: true,
      errorMessage: 'End date must be a valid ISO 8601 date',
    },
    isActive: {
      in: ['body'],
      isBoolean: true,
      optional: true,
      errorMessage: 'isActive should be a boolean',
    },
    discountType: {
      in: ['body'],
      isString: true,
      isIn: {
        options: [['percentage', 'fixed']],
        errorMessage: 'Discount type must be either percentage or fixed',
      },
    },
    discountValue: {
      in: ['body'],
      isNumeric: true,
      errorMessage: 'Discount value must be a number',
    },
    products: {
      in: ['body'],
      isArray: true,
      optional: true,
      errorMessage: 'Products should be an array',
    },
    'products.*': {
      in: ['body'],
      isMongoId: true,
      errorMessage: 'Each product ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateCampaignValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    campaignId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Campaign ID must be a valid MongoDB ID',
    },
    name: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Campaign name should be a string',
    },
    description: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Description should be a string',
    },
    startDate: {
      in: ['body'],
      isISO8601: true,
      optional: true,
      errorMessage: 'Start date must be a valid ISO 8601 date',
    },
    endDate: {
      in: ['body'],
      isISO8601: true,
      optional: true,
      errorMessage: 'End date must be a valid ISO 8601 date',
    },
    isActive: {
      in: ['body'],
      isBoolean: true,
      optional: true,
      errorMessage: 'isActive should be a boolean',
    },
    discountType: {
      in: ['body'],
      isString: true,
      optional: true,
      isIn: {
        options: [['percentage', 'fixed']],
        errorMessage: 'Discount type must be either percentage or fixed',
      },
    },
    discountValue: {
      in: ['body'],
      isNumeric: true,
      optional: true,
      errorMessage: 'Discount value must be a number',
    },
    products: {
      in: ['body'],
      isArray: true,
      optional: true,
      errorMessage: 'Products should be an array',
    },
    'products.*': {
      in: ['body'],
      isMongoId: true,
      errorMessage: 'Each product ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const campaignIdValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    campaignId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Campaign ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const toggleStatusValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    campaignId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Campaign ID must be a valid MongoDB ID',
    },
    isActive: {
      in: ['body'],
      isBoolean: true,
      errorMessage: 'isActive must be a boolean',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const addProductValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    campaignId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Campaign ID must be a valid MongoDB ID',
    },
    productId: {
      in: ['body'],
      isMongoId: true,
      errorMessage: 'Product ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const removeProductValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    campaignId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Campaign ID must be a valid MongoDB ID',
    },
    productId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Product ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const CampaignValidator = {
  createCampaignValidator,
  updateCampaignValidator,
  campaignIdValidator,
  toggleStatusValidator,
  addProductValidator,
  removeProductValidator,
};

export default CampaignValidator;
