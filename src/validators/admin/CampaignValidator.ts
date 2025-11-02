import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const createCampaignValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    slug: {
      in: ['body'],
      isString: true,
      trim: true,
      toLowerCase: true,
      notEmpty: true,
      matches: {
        options: [/^[a-z0-9-]+$/],
        errorMessage: 'slug may only contain lowercase letters, numbers, and hyphens',
      },
      errorMessage: 'slug is required',
    },
    image: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'image is required' },
    title: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'title is required' },
    description: { in: ['body'], optional: true, isString: true },
    status: {
      in: ['body'],
      optional: true,
      isIn: { options: [['active', 'inactive', 'draft']], errorMessage: 'status must be active|inactive|draft' },
    },
    startDate: {
      in: ['body'],
      optional: true,
      isISO8601: { errorMessage: 'startDate must be ISO8601 if provided' },
      custom: {
        options: (value, { req }) => {
          if (value && !req.body.endDate) return false;
          return true;
        },
        errorMessage: 'Both startDate and endDate must be provided together',
      },
    },
    endDate: {
      in: ['body'],
      optional: true,
      isISO8601: { errorMessage: 'endDate must be ISO8601 if provided' },
      custom: {
        options: (value, { req }) => {
          if (value && !req.body.startDate) return false;
          return true;
        },
        errorMessage: 'Both startDate and endDate must be provided together',
      },
    },
    products: { in: ['body'], optional: true, isArray: true },
    'products.*': { in: ['body'], isMongoId: true, errorMessage: 'each product must be a valid id' },
    sales: { in: ['body'], optional: true, isArray: true },
    'sales.*': { in: ['body'], isMongoId: true, errorMessage: 'each sale must be a valid id' },
  }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateCampaignValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    campaignId: { in: ['params'], isMongoId: true, errorMessage: 'Campaign ID must be a valid MongoDB ID' },
    slug: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      toLowerCase: true,
      matches: {
        options: [/^[a-z0-9-]+$/],
        errorMessage: 'slug may only contain lowercase letters, numbers, and hyphens',
      },
    },
    image: { in: ['body'], optional: true, isString: true },
    title: { in: ['body'], optional: true, isString: true },
    description: { in: ['body'], optional: true, isString: true },
    status: {
      in: ['body'],
      optional: true,
      isIn: { options: [['active', 'inactive', 'draft']], errorMessage: 'status must be active|inactive|draft' },
    },
    startDate: { in: ['body'], optional: true, isISO8601: { errorMessage: 'startDate must be ISO8601' } },
    endDate: { in: ['body'], optional: true, isISO8601: { errorMessage: 'endDate must be ISO8601' } },
    products: { in: ['body'], optional: true, isArray: true },
    'products.*': { in: ['body'], optional: true, isMongoId: true },
    sales: { in: ['body'], optional: true, isArray: true },
    'sales.*': { in: ['body'], optional: true, isMongoId: true },
  }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const campaignIdValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    campaignId: { in: ['params'], isMongoId: true, errorMessage: 'Campaign ID must be a valid MongoDB ID' },
  }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const toggleStatusValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    campaignId: { in: ['params'], isMongoId: true, errorMessage: 'Campaign ID must be a valid MongoDB ID' },
    status: {
      in: ['body'],
      isIn: { options: [['active', 'inactive']], errorMessage: 'status must be active or inactive' },
    },
  }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const addProductValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    campaignId: { in: ['params'], isMongoId: true, errorMessage: 'Campaign ID must be a valid MongoDB ID' },
    productId: { in: ['body'], isMongoId: true, errorMessage: 'Product ID must be a valid MongoDB ID' },
  }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const removeProductValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    campaignId: { in: ['params'], isMongoId: true, errorMessage: 'Campaign ID must be a valid MongoDB ID' },
    productId: { in: ['params'], isMongoId: true, errorMessage: 'Product ID must be a valid MongoDB ID' },
  }).run(req);
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
