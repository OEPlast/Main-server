import { Request, Response, NextFunction } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const validateUpdateSettings = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    storeName: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Store name must be a string',
    },
    companyName: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Company name must be a string',
    },
    logoUrl: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Logo URL must be a string',
    },
    websiteUrl: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Website URL must be a string',
    },
    supportEmail: {
      in: ['body'],
      optional: true,
      isEmail: true,
      normalizeEmail: true,
      errorMessage: 'Support email must be a valid email address',
    },
    supportPhone: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Support phone must be a string',
    },
    'address.line1': {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Address line 1 must be a string',
    },
    'address.line2': {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Address line 2 must be a string',
    },
    'address.city': {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'City must be a string',
    },
    'address.state': {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'State must be a string',
    },
    'address.zip': {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'ZIP code must be a string',
    },
    'address.country': {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Country must be a string',
    },
    taxId: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Tax ID must be a string',
    },
    taxRate: {
      in: ['body'],
      optional: true,
      isFloat: {
        options: { min: 0, max: 100 },
      },
      toFloat: true,
      errorMessage: 'Tax rate must be a number between 0 and 100',
    },
    currency: {
      in: ['body'],
      optional: true,
      isString: true,
      trim: true,
      isLength: {
        options: { min: 3, max: 3 },
      },
      errorMessage: 'Currency must be a 3-letter currency code (e.g., USD)',
    },
  }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const SettingsValidator = {
  validateUpdateSettings,
};

export default SettingsValidator;
