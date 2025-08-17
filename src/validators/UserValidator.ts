import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, oneOf, validationResult } from 'express-validator';

const validateUserProfileUpdate = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      firstName: {
        in: ['body'],
        optional: true,
        notEmpty: true,
        isString: {
          errorMessage: 'First name must be a string',
        },
      },
      lastName: {
        in: ['body'],
        optional: true,
        notEmpty: true,
        isString: {
          errorMessage: 'Last name must be a string',
        },
      },
      image: {
        in: ['body'],
        optional: true,
        notEmpty: true,
        isString: {
          errorMessage: 'Image must be a string',
        },
      },
      country: {
        in: ['body'],
        optional: true,
        notEmpty: true,
        isString: {
          errorMessage: 'Country must be a string',
        },
      },
      dob: {
        in: ['body'],
        optional: true,
        notEmpty: true,
        isISO8601: {
          errorMessage: 'Date of birth must be a valid ISO 8601 date',
        },
      },
      notifications: {
        in: ['body'],
        optional: true,
        notEmpty: true,
        isBoolean: {
          errorMessage: 'Notifications must be a boolean',
        },
      },
    })
  ).run(req);

  // Require at least one of them
  await oneOf(
    [
      checkSchema({ firstName: { in: ['body'], exists: true } }),
      checkSchema({ lastName: { in: ['body'], exists: true } }),
      checkSchema({ image: { in: ['body'], exists: true } }),
      checkSchema({ country: { in: ['body'], exists: true } }),
      checkSchema({ dob: { in: ['body'], exists: true } }),
      checkSchema({ notifications: { in: ['body'], exists: true } }),
    ],
    { message: 'Supply at least one of the required fields', errorType: 'least_errored' }
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

const validateAddAddress = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      firstName: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'firstName is required' },
      lastName: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'lastName is required' },
      phoneNumber: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'phoneNumber is required' },
      address1: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'address1 is required' },
      address2: { in: ['body'], optional: true, isString: true },
      city: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'city is required' },
      zipCode: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'zipCode is required' },
      state: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'state is required' },
      country: { in: ['body'], isString: true, notEmpty: true, errorMessage: 'country is required' },
      active: { in: ['body'], optional: true, isBoolean: true, errorMessage: 'active must be boolean' },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};
const validateUpdateAddress = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    addressId: { in: ['params'], isMongoId: true, errorMessage: 'addressId must be a valid id' },
  }).run(req);
  await checkExact(
    checkSchema({
      firstName: { in: ['body'], optional: true, isString: true },
      lastName: { in: ['body'], optional: true, isString: true },
      phoneNumber: { in: ['body'], optional: true, isString: true },
      address1: { in: ['body'], optional: true, isString: true },
      address2: { in: ['body'], optional: true, isString: true },
      city: { in: ['body'], optional: true, isString: true },
      zipCode: { in: ['body'], optional: true, isString: true },
      state: { in: ['body'], optional: true, isString: true },
      country: { in: ['body'], optional: true, isString: true },
      active: { in: ['body'], optional: true, isBoolean: true },
    })
  ).run(req);
  // Require at least one field
  await oneOf([
    checkSchema({ firstName: { in: ['body'], exists: true } }),
    checkSchema({ lastName: { in: ['body'], exists: true } }),
    checkSchema({ phoneNumber: { in: ['body'], exists: true } }),
    checkSchema({ address1: { in: ['body'], exists: true } }),
    checkSchema({ address2: { in: ['body'], exists: true } }),
    checkSchema({ city: { in: ['body'], exists: true } }),
    checkSchema({ zipCode: { in: ['body'], exists: true } }),
    checkSchema({ state: { in: ['body'], exists: true } }),
    checkSchema({ country: { in: ['body'], exists: true } }),
    checkSchema({ active: { in: ['body'], exists: true } }),
  ]).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};
const validateDeleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    addressId: { in: ['params'], isMongoId: true, errorMessage: 'addressId must be a valid id' },
  }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const UserValidator = {
  validateUserProfileUpdate,
  validateUserSettingsUpdate,
  validateStoreSettings,
  validateAddAddress,
  validateUpdateAddress,
  validateDeleteAddress,
};

export default UserValidator;
