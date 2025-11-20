import type { NextFunction, Request, Response } from 'express';
import { checkSchema, checkExact, validationResult, oneOf, param } from 'express-validator';
import type { CustomValidator, Meta } from 'express-validator';
type RequestVariant = {
  attributeName?: string | null;
  attributeValue?: string | null;
  discount?: number;
  amountOff?: number;
  maxBuys?: number;
  boughtCount?: number;
};
type VariantsBody = { variants?: RequestVariant[] };

// Helpers to validate cross-field rules inside variants
const xorDiscountAmountOff: CustomValidator = (_value: unknown, meta: Meta) => {
  const { req, path } = meta;
  const segments = (path || '').split('.'); // e.g., variants.0.discount
  const idx = Number(segments[1]);
  const body = (req as Request).body as VariantsBody;
  const variant = Array.isArray(body?.variants) ? body.variants[idx] : undefined;
  if (!variant) return true; // other validators will catch shape issues
  const discount = Number(variant.discount || 0);
  const amountOff = Number(variant.amountOff || 0);
  // Exactly one must be a positive number
  return discount > 0 !== amountOff > 0;
};

const attributePairValid: CustomValidator = (_value: unknown, meta: Meta) => {
  const { req, path } = meta;
  const segments = (path || '').split('.'); // variants.0.attributeValue
  const idx = Number(segments[1]);
  const body = (req as Request).body as VariantsBody;
  const v = Array.isArray(body?.variants) ? body.variants[idx] : undefined;
  if (!v) return true;
  const bothNull = (v.attributeName ?? null) === null && (v.attributeValue ?? null) === null;
  const bothString = typeof v.attributeName === 'string' && typeof v.attributeValue === 'string';
  return bothNull || bothString;
};

const createSaleValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema(
      {
        title: { in: ['body'], optional: true, isString: true, errorMessage: 'title must be a string' },
        product: { in: ['body'], isMongoId: true, errorMessage: 'product must be a valid id' },
        isActive: { in: ['body'], optional: true, isBoolean: true, toBoolean: true },
        deleted: { in: ['body'], optional: true, isBoolean: true, toBoolean: true },
        campaign: { in: ['body'], optional: true, isMongoId: true, errorMessage: 'campaign must be a valid id' },
        type: {
          in: ['body'],
          optional: true,
          isIn: { options: [['Flash', 'Limited', 'Normal']], errorMessage: 'Invalid sale type' },
        },
        startDate: {
          in: ['body'],
          optional: true,
          isISO8601: { errorMessage: 'startDate must be a valid ISO date' },
          toDate: true,
          custom: {
            options: (_value, { req }) => {
              if (req.body.type === 'Flash') {
                return Boolean(req.body.startDate && req.body.endDate);
              }
              return true;
            },
            errorMessage: 'Flash sales require both startDate and endDate',
          },
        },
        endDate: {
          in: ['body'],
          optional: true,
          isISO8601: { errorMessage: 'endDate must be a valid ISO date' },
          toDate: true,
          custom: {
            options: (_value, { req }) => {
              if (req.body.type === 'Flash' && req.body.startDate && req.body.endDate) {
                return new Date(req.body.endDate) > new Date(req.body.startDate);
              }
              return true;
            },
            errorMessage: 'endDate must be later than startDate for Flash sales',
          },
        },
        variants: { in: ['body'], optional: true, isArray: true },
        'variants.*.attributeName': { in: ['body'], optional: true },
        'variants.*.attributeValue': {
          in: ['body'],
          optional: true,
          custom: { options: attributePairValid },
          errorMessage: 'attributeName and attributeValue must both be null or both strings',
        },
        'variants.*.discount': {
          in: ['body'],
          optional: true,
          isFloat: { options: { min: 0 }, errorMessage: 'discount must be >= 0' },
          custom: { options: xorDiscountAmountOff },
          errorMessage: 'Exactly one of discount or amountOff must be a positive number',
        },
        'variants.*.amountOff': {
          in: ['body'],
          optional: true,
          isFloat: { options: { min: 0 }, errorMessage: 'amountOff must be >= 0' },
          custom: { options: xorDiscountAmountOff },
          errorMessage: 'Exactly one of discount or amountOff must be a positive number',
        },
        'variants.*.maxBuys': {
          in: ['body'],
          optional: true,
          isInt: { options: { min: 0 }, errorMessage: 'maxBuys must be an integer >= 0' },
          toInt: true,
        },
        'variants.*.boughtCount': {
          in: ['body'],
          optional: true,
          isInt: { options: { min: 0 }, errorMessage: 'boughtCount must be an integer >= 0' },
          toInt: true,
        },
      },
      ['body']
    )
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const updateSaleValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema(
      {
        id: { in: ['params'], isMongoId: true, errorMessage: 'id must be a valid MongoDB id' },
        title: { in: ['body'], optional: true, isString: true },
        product: { in: ['body'], optional: true, isMongoId: true },
        updatedBy: { in: ['body'], optional: true, isMongoId: true },
        isActive: { in: ['body'], optional: true, isBoolean: true, toBoolean: true },
        deleted: { in: ['body'], optional: true, isBoolean: true, toBoolean: true },
        campaign: { in: ['body'], optional: true, isMongoId: true },
        isHot: { in: ['body'], optional: true, isBoolean: true, toBoolean: true },
        type: { in: ['body'], optional: true, isIn: { options: [['Flash', 'Normal', 'Limited']] } },
        startDate: {
          in: ['body'],
          optional: true,
          isISO8601: { errorMessage: 'startDate must be a valid ISO date' },
          toDate: true,
        },
        endDate: {
          in: ['body'],
          optional: true,
          isISO8601: { errorMessage: 'endDate must be a valid ISO date' },
          toDate: true,
          custom: {
            options: (_value, { req }) => {
              if (req.body.type === 'Flash' && req.body.startDate && req.body.endDate) {
                return new Date(req.body.endDate) > new Date(req.body.startDate);
              }
              return true;
            },
            errorMessage: 'endDate must be later than startDate for Flash sales',
          },
        },
        variants: { in: ['body'], optional: true, isArray: true },
        'variants.*.attributeName': { in: ['body'], optional: true, isString: true },
        'variants.*.attributeValue': {
          in: ['body'],
          optional: true,
          custom: { options: attributePairValid },
          errorMessage: 'attributeName and attributeValue must both be null or both strings',
        },
        'variants.*.discount': {
          in: ['body'],
          optional: true,
          isFloat: { options: { min: 0 } },
          custom: { options: xorDiscountAmountOff },
        },
        'variants.*.amountOff': {
          in: ['body'],
          optional: true,
          isFloat: { options: { min: 0 } },
          custom: { options: xorDiscountAmountOff },
        },
        'variants.*.maxBuys': { in: ['body'], optional: true, isInt: { options: { min: 0 } }, toInt: true },
        'variants.*.boughtCount': { in: ['body'], optional: true, isInt: { options: { min: 0 } }, toInt: true },
      },
      ['params', 'body']
    )
  ).run(req);

  await oneOf(
    [
      checkSchema({ title: { in: ['body'], notEmpty: true } }),
      checkSchema({ product: { in: ['body'], notEmpty: true } }),
      checkSchema({ updatedBy: { in: ['body'], notEmpty: true } }),
      checkSchema({ type: { in: ['body'], notEmpty: true } }),
      checkSchema({ startDate: { in: ['body'], notEmpty: true } }),
      checkSchema({ endDate: { in: ['body'], notEmpty: true } }),
      checkSchema({ variants: { in: ['body'], isArray: { options: { min: 1 } } } }),
    ],
    { message: 'Provide at least one field to update' }
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const saleIdValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(checkSchema({ id: { in: ['params'], isMongoId: true, errorMessage: 'Invalid sale id' } })).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const salesTypeValidator = [param('type').isIn(['Flash', 'Limited', 'Normal'])];

const SalesValidator = {
  createSaleValidator,
  updateSaleValidator,
  saleIdValidator,
  salesTypeValidator,
};

export default SalesValidator;
