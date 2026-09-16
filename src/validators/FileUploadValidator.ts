import type { Request, Response, NextFunction } from 'express';
import { checkSchema, validationResult, checkExact } from 'express-validator';

// Allowed categories. The category becomes the storage folder, so it must never be free text.
export const ALLOWED_FILE_CATEGORIES = [
  'product',
  'campaign',
  'users',
  'user',
  'banner',
  'reviews',
  'return',
  'category',
  'settings',
  'misc',
  'general',
] as const;
export type FileCategory = (typeof ALLOWED_FILE_CATEGORIES)[number];

/** Folders a customer may write to. Everything else (product, banner, settings…) is staff-only. */
export const CUSTOMER_FILE_CATEGORIES: readonly FileCategory[] = ['user', 'users', 'reviews', 'return'];
const STAFF_ROLES = ['owner', 'manager', 'employee'];

// Normalize category: lowercase, trim, replace spaces and unsafe chars with dash
export const normalizeCategory = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-');
};

/**
 * Checks the upload category. Must run AFTER multer: the category is a field of the multipart
 * form, and before multer parses it `req.body` is empty — which is how the old check (mounted
 * before multer) passed every request and let any signed-in user choose any storage folder,
 * including other folders' paths. Normalises in place so the controller uses the clean value.
 */
const categoryBodyValidator = (req: Request, res: Response, next: NextFunction) => {
  const raw = (req.body?.category ?? req.query?.category ?? 'general') as unknown;
  if (typeof raw !== 'string') {
    return res.status(400).json({ message: 'Invalid category' });
  }
  const category = normalizeCategory(raw);
  if (!ALLOWED_FILE_CATEGORIES.includes(category as FileCategory)) {
    return res.status(400).json({ message: `Invalid category. Allowed: ${ALLOWED_FILE_CATEGORIES.join(', ')}` });
  }
  const role = (req as Request & { role?: string }).role ?? '';
  if (!STAFF_ROLES.includes(role) && !CUSTOMER_FILE_CATEGORIES.includes(category as FileCategory)) {
    return res.status(403).json({ message: 'You cannot upload to that folder' });
  }
  req.body = { ...(req.body ?? {}), category };
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
