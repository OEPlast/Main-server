import type { Request, Response, NextFunction } from 'express';
import { checkSchema, checkExact, validationResult, oneOf } from 'express-validator';

// Allowed coupon types & discount types kept in sync with model typings
const COUPON_TYPES = ['one-off', 'one-off-user', 'one-off-for-one-person', 'normal'] as const;
const DISCOUNT_TYPES = ['percentage', 'fixed'] as const;
const APPLIES_SCOPES = ['order', 'product', 'category'] as const;

type CouponTypeValue = (typeof COUPON_TYPES)[number];
type DiscountTypeValue = (typeof DISCOUNT_TYPES)[number];

declare module 'express-serve-static-core' {
  // augmentation example (not currently required, kept minimal)
  interface Request {}
}

const createCouponValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      coupon: {
        in: ['body'],
        isString: true,
        trim: true,
        notEmpty: true,
        errorMessage: 'coupon code is required',
        isLength: { options: { min: 4, max: 20 }, errorMessage: 'coupon code must be between 4 and 20 characters' },
      },
      startDate: {
        in: ['body'],
        isISO8601: true,
        errorMessage: 'startDate must be a valid ISO8601 date string',
      },
      endDate: {
        in: ['body'],
        isISO8601: true,
        custom: {
          options: (value, { req }) => new Date(value) > new Date(req.body.startDate),
        },
        errorMessage: 'endDate must be a valid ISO8601 date string later than startDate',
      },
      discount: {
        in: ['body'],
        custom: {
          options: (value) => {
            if (value === undefined || value === null) return false;
            const num = Number(value);
            return !Number.isNaN(num) && num > 0;
          },
        },
        errorMessage: 'discount must be a positive number',
      },
      active: {
        in: ['body'],
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'active must be a boolean',
      },
      couponType: {
        in: ['body'],
        optional: true,
        custom: {
          options: (value) => COUPON_TYPES.includes(value as CouponTypeValue),
        },
        errorMessage: `couponType must be one of: ${COUPON_TYPES.join(', ')}`,
      },
      allowedUser: {
        in: ['body'],
        optional: true,
        isMongoId: true,
        errorMessage: 'allowedUser must be a valid Mongo ID',
      },
      maxUsage: {
        in: ['body'],
        optional: true,
        custom: { options: (v) => v === null || (Number.isInteger(Number(v)) && Number(v) >= 0) },
        errorMessage: 'maxUsage must be a non-negative integer or null',
      },
      maxUsagePerUser: {
        in: ['body'],
        optional: true,
        custom: { options: (v) => v === null || (Number.isInteger(Number(v)) && Number(v) >= 0) },
        errorMessage: 'maxUsagePerUser must be a non-negative integer or null',
      },
      minOrderValue: {
        in: ['body'],
        optional: true,
        custom: { options: (v) => v === null || (!Number.isNaN(Number(v)) && Number(v) >= 0) },
        errorMessage: 'minOrderValue must be a non-negative number or null',
      },
      discountType: {
        in: ['body'],
        optional: true,
        custom: { options: (v) => DISCOUNT_TYPES.includes(v as DiscountTypeValue) },
        errorMessage: `discountType must be one of: ${DISCOUNT_TYPES.join(', ')}`,
      },
      stackable: {
        in: ['body'],
        optional: true,
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'stackable must be a boolean',
      },
      showOnCartPage: {
        in: ['body'],
        optional: true,
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'showOnCartPage must be a boolean',
      },
      notes: {
        in: ['body'],
        optional: true,
        isString: true,
        trim: true,
        isLength: { options: { max: 500 } },
        errorMessage: 'notes must be a string up to 500 chars',
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const updateCouponValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: { in: ['params'], isMongoId: true, errorMessage: 'id param must be a valid Mongo ID' },
      coupon: { in: ['body'], optional: true, isString: true, trim: true },
      startDate: { in: ['body'], optional: true, isISO8601: true },
      endDate: {
        in: ['body'],
        optional: true,
        isISO8601: true,
        custom: { options: (value, { req }) => !req.body.startDate || new Date(value) > new Date(req.body.startDate) },
        errorMessage: 'endDate must be later than startDate if both provided',
      },
      discount: {
        in: ['body'],
        optional: true,
        custom: { options: (value) => value === undefined || (Number(value) > 0 && !Number.isNaN(Number(value))) },
        errorMessage: 'discount must be a positive number',
      },
      active: { in: ['body'], optional: true, isBoolean: true, toBoolean: true },
      couponType: {
        in: ['body'],
        optional: true,
        custom: { options: (value) => COUPON_TYPES.includes(value as CouponTypeValue) },
        errorMessage: `couponType must be one of: ${COUPON_TYPES.join(', ')}`,
      },
      allowedUser: { in: ['body'], optional: true, isMongoId: true },
      maxUsage: {
        in: ['body'],
        optional: true,
        custom: { options: (v) => v === null || (Number.isInteger(Number(v)) && Number(v) >= 0) },
      },
      maxUsagePerUser: {
        in: ['body'],
        optional: true,
        custom: { options: (v) => v === null || (Number.isInteger(Number(v)) && Number(v) >= 0) },
      },
      minOrderValue: {
        in: ['body'],
        optional: true,
        custom: { options: (v) => v === null || (!Number.isNaN(Number(v)) && Number(v) >= 0) },
      },
      discountType: {
        in: ['body'],
        optional: true,
        custom: { options: (v) => DISCOUNT_TYPES.includes(v as DiscountTypeValue) },
      },
      stackable: { in: ['body'], optional: true, isBoolean: true, toBoolean: true },
      showOnCartPage: { in: ['body'], optional: true, isBoolean: true, toBoolean: true },
      'appliesTo.scope': { in: ['body'], optional: true, custom: { options: (v) => APPLIES_SCOPES.includes(v) } },
      'appliesTo.productIds': { in: ['body'], optional: true, isArray: true },
      'appliesTo.productIds.*': { in: ['body'], optional: true, isMongoId: true },
      'appliesTo.categoryIds': { in: ['body'], optional: true, isArray: true },
      'appliesTo.categoryIds.*': { in: ['body'], optional: true, isMongoId: true },
      notes: { in: ['body'], optional: true, isString: true, trim: true, isLength: { options: { max: 500 } } },
    })
  ).run(req);

  // Ensure at least one updatable field is present
  await oneOf(
    [
      checkSchema({ coupon: { in: ['body'], notEmpty: true } }),
      checkSchema({ startDate: { in: ['body'], notEmpty: true } }),
      checkSchema({ endDate: { in: ['body'], notEmpty: true } }),
      checkSchema({ discount: { in: ['body'], notEmpty: true } }),
      checkSchema({ active: { in: ['body'], notEmpty: true } }),
      checkSchema({ couponType: { in: ['body'], notEmpty: true } }),
      checkSchema({ allowedUser: { in: ['body'], notEmpty: true } }),
      checkSchema({ maxUsage: { in: ['body'], notEmpty: true } }),
      checkSchema({ maxUsagePerUser: { in: ['body'], notEmpty: true } }),
      checkSchema({ minOrderValue: { in: ['body'], notEmpty: true } }),
      checkSchema({ discountType: { in: ['body'], notEmpty: true } }),
      checkSchema({ stackable: { in: ['body'], notEmpty: true } }),
      checkSchema({ showOnCartPage: { in: ['body'], notEmpty: true } }),
      checkSchema({ 'appliesTo.scope': { in: ['body'], notEmpty: true } }),
      checkSchema({ notes: { in: ['body'], notEmpty: true } }),
    ],
    { message: 'At least one field must be provided for update' }
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const couponIdParamValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: { in: ['params'], isMongoId: true, errorMessage: 'id param must be a valid Mongo ID' },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Advanced query validator for filters/search/sort
export const couponListQueryValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      page: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1 } },
        toInt: true,
        errorMessage: 'page must be a positive integer',
      },
      limit: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1, max: 100 } },
        toInt: true,
        errorMessage: 'limit must be between 1 and 100',
      },
      active: {
        in: ['query'],
        optional: true,
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'active must be boolean',
      },
      couponType: {
        in: ['query'],
        optional: true,
        isIn: {
          options: [['one-off', 'one-off-user', 'one-off-for-one-person', 'normal']],
        },
        errorMessage: 'invalid couponType',
      },
      search: {
        in: ['query'],
        optional: true,
        isString: true,
        trim: true,
        isLength: { options: { max: 100 } },
        errorMessage: 'search too long',
      },
      startDate: {
        in: ['query'],
        optional: true,
        isISO8601: true,
        errorMessage: 'startDateFrom must be ISO date',
      },
      endDate: {
        in: ['query'],
        optional: true,
        isISO8601: true,
        errorMessage: 'endDateTo must be ISO date',
      },
      sort: {
        in: ['query'],
        optional: true,
        errorMessage: 'sort contains invalid fields',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const CouponValidator = {
  createCouponValidator,
  updateCouponValidator,
  couponIdParamValidator,
  couponListQueryValidator,
};

export default CouponValidator;
