import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult, type Schema } from 'express-validator';

const STATUSES = ['active', 'inactive', 'draft'];

/**
 * Shared field rules. `optional` flips them on for the partial-update case.
 * The explicit `Schema` return type matters: without it the object literal is
 * widened (e.g. `matches.options` becomes `RegExp[]` instead of `[RegExp]`) and
 * no longer satisfies checkSchema's parameter type.
 */
const intentBodySchema = (optional: boolean): Schema => ({
  slug: {
    in: ['body' as const],
    optional,
    isString: true,
    trim: true,
    toLowerCase: true,
    notEmpty: true,
    matches: {
      options: [/^[a-z0-9-_]+$/],
      errorMessage: 'slug may only contain lowercase letters, numbers, underscores, and hyphens',
    },
    errorMessage: 'slug is required',
  },
  heading: {
    in: ['body' as const],
    optional,
    isString: true,
    trim: true,
    notEmpty: true,
    errorMessage: 'heading is required',
  },
  title: {
    in: ['body' as const],
    optional,
    isString: true,
    trim: true,
    notEmpty: true,
    errorMessage: 'title is required',
  },
  description: {
    in: ['body' as const],
    optional,
    isString: true,
    trim: true,
    notEmpty: true,
    errorMessage: 'description is required',
  },
  keywords: {
    in: ['body' as const],
    optional: true,
    isArray: { errorMessage: 'keywords must be an array of strings' },
  },
  intro: { in: ['body' as const], optional: true, isString: true, trim: true },
  status: {
    in: ['body' as const],
    optional: true,
    isIn: { options: [STATUSES], errorMessage: 'status must be active|inactive|draft' },
  },

  // ── products (ordered — array order is the storefront display order) ──────
  products: {
    in: ['body' as const],
    optional,
    isArray: { options: { min: 1 }, errorMessage: 'Select at least one product' },
  },
  'products.*': {
    in: ['body' as const],
    isMongoId: { errorMessage: 'Each product must be a valid product id' },
  },

  // ── faqs ──────────────────────────────────────────────────────────────────
  faqs: {
    in: ['body' as const],
    optional: true,
    isArray: { errorMessage: 'faqs must be an array' },
  },
  'faqs.*.question': {
    in: ['body' as const],
    isString: true,
    trim: true,
    notEmpty: true,
    errorMessage: 'each FAQ needs a question',
  },
  'faqs.*.answer': {
    in: ['body' as const],
    isString: true,
    trim: true,
    notEmpty: true,
    errorMessage: 'each FAQ needs an answer',
  },
});

const runValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const createIntentValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema(intentBodySchema(false)).run(req);
  return runValidation(req, res, next);
};

const updateIntentValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    intentId: { in: ['params'], isMongoId: true, errorMessage: 'Intent ID must be a valid MongoDB ID' },
    ...intentBodySchema(true),
  }).run(req);
  return runValidation(req, res, next);
};

const intentIdValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    intentId: { in: ['params'], isMongoId: true, errorMessage: 'Intent ID must be a valid MongoDB ID' },
  }).run(req);
  return runValidation(req, res, next);
};

const toggleStatusValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    intentId: { in: ['params'], isMongoId: true, errorMessage: 'Intent ID must be a valid MongoDB ID' },
    status: {
      in: ['body'],
      isIn: { options: [STATUSES], errorMessage: 'status must be active|inactive|draft' },
    },
  }).run(req);
  return runValidation(req, res, next);
};

const IntentValidator = {
  createIntentValidator,
  updateIntentValidator,
  intentIdValidator,
  toggleStatusValidator,
};

export default IntentValidator;
