import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, oneOf, validationResult } from 'express-validator';

const validateUserProfileUpdate = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      firstName: {
        in: ['body'],
        optional: true,
        isString: {
          errorMessage: 'First name must be a string',
        },
      },
      lastName: {
        in: ['body'],
        optional: true,
        isString: {
          errorMessage: 'Last name must be a string',
        },
      },
    })
  ).run(req);

  // Require at least one of them
  await oneOf(
    [
      checkSchema({ firstName: { in: ['body'], exists: true } }),
      checkSchema({ lastName: { in: ['body'], exists: true } }),
    ],
    { message: 'Supply at least one of Firstname or Lastname', errorType: 'least_errored' }
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateUserSettingsUpdate = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      notifications: {
        in: ['body'],
        optional: true,
        isBoolean: true,
        errorMessage: 'Notifications must be a boolean',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateStoreSettings = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    storeName: { in: ['body'], optional: true, isString: true },
    companyName: { in: ['body'], optional: true, isString: true },
    logoUrl: { in: ['body'], optional: true, isString: true },
    websiteUrl: { in: ['body'], optional: true, isString: true },
    supportEmail: { in: ['body'], optional: true, isEmail: true },
    supportPhone: { in: ['body'], optional: true, isString: true },
    currency: { in: ['body'], optional: true, isString: true },
    taxId: { in: ['body'], optional: true, isString: true },
    address: { in: ['body'], optional: true, isObject: true },
    'address.line1': { in: ['body'], optional: true, isString: true },
    'address.line2': { in: ['body'], optional: true, isString: true },
    'address.city': { in: ['body'], optional: true, isString: true },
    'address.state': { in: ['body'], optional: true, isString: true },
    'address.zip': { in: ['body'], optional: true, isString: true },
    'address.country': { in: ['body'], optional: true, isString: true },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const UserValidator = {
  validateUserProfileUpdate,
  validateUserSettingsUpdate,
  validateStoreSettings,
};

export default UserValidator;
