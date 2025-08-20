import type { Request, Response, NextFunction } from 'express';
import { checkSchema, validationResult, checkExact } from 'express-validator';

// Allowed categories (can be extended)
export const ALLOWED_FILE_CATEGORIES = [
  'product',
  'campaign',
  'users',
  'banner',
  'reviews',
  'category',
  'misc',
  'general',
] as const;
export type FileCategory = (typeof ALLOWED_FILE_CATEGORIES)[number];

// Normalize category: lowercase, trim, replace spaces and unsafe chars with dash
export const normalizeCategory = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-');
};

const categoryBodyValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      category: {
        in: ['body'],
        optional: true,
        isString: true,
        trim: true,
        customSanitizer: {
          options: (v: string) => normalizeCategory(v),
        },
        custom: {
          options: (v: string) => !v || ALLOWED_FILE_CATEGORIES.includes(v as FileCategory),
        },
        errorMessage: `Invalid category. Allowed: ${ALLOWED_FILE_CATEGORIES.join(', ')}`,
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const categoryParamValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      category: {
        in: ['params'],
        isString: true,
        trim: true,
        customSanitizer: {
          options: (v: string) => normalizeCategory(v),
        },
        custom: {
          options: (v: string) => ALLOWED_FILE_CATEGORIES.includes(v as FileCategory),
        },
        errorMessage: `Invalid category. Allowed: ${ALLOWED_FILE_CATEGORIES.join(', ')}`,
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

export default { categoryBodyValidator, categoryParamValidator };
