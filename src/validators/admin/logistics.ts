import { body, param } from 'express-validator';

export const upsertConfigValidator = [
  body('countryCode').isString().trim().isLength({ min: 2, max: 3 }),
  body('countryName').isString().trim().isLength({ min: 2 }),
  body('states').isArray(),
  body('states.*.name').isString().trim(),
  body('states.*.fallbackPrice').optional().isFloat({ min: 0 }),
  body('states.*.fallbackEtaDays').optional().isInt({ min: 0 }),
  body('states.*.cities').optional().isArray(),
  body('states.*.cities.*.name').optional().isString().trim(),
  body('states.*.cities.*.price').optional().isFloat({ min: 0 }),
  body('states.*.cities.*.etaDays').optional().isInt({ min: 0 }),
  body('states.*.lgas').optional().isArray(),
  body('states.*.lgas.*.name').optional().isString().trim(),
  body('states.*.lgas.*.price').optional().isFloat({ min: 0 }),
  body('states.*.lgas.*.etaDays').optional().isInt({ min: 0 }),
];

export const getByCountryValidator = [param('country').isString().trim()];

export const createEmptyCountryValidator = [
  body('countryCode').isString().trim().isLength({ min: 2, max: 4 }),
  body('countryName').isString().trim().isLength({ min: 2 }),
];

export const deleteCountryValidator = [param('id').isMongoId().trim()];

export const updateConfigIdValidator = [param('id').isMongoId()];

// Partial update validator for PATCH /admin/logistics/config/:id
export const updateConfigPartialValidator = [
  body().custom((value) => {
    if (!value || typeof value !== 'object') return false;
    const keys = Object.keys(value);
    const allowed = ['countryCode', 'countryName', 'states'];
    const hasAllowed = keys.some((k) => allowed.includes(k));
    if (!hasAllowed) {
      throw new Error('At least one of countryCode, countryName, states must be provided');
    }
    return true;
  }),
  body('countryCode').optional().isString().trim().isLength({ min: 2, max: 3 }),
  body('countryName').optional().isString().trim().isLength({ min: 2 }),
  body('states').optional().isArray(),
  body('states.*.name').optional().isString().trim(),
  body('states.*.fallbackPrice').optional().isFloat({ min: 0 }),
  body('states.*.fallbackEtaDays').optional().isInt({ min: 0 }),
  body('states.*.cities').optional().isArray(),
  body('states.*.cities.*.name').optional().isString().trim(),
  body('states.*.cities.*.price').optional().isFloat({ min: 0 }),
  body('states.*.cities.*.etaDays').optional().isInt({ min: 0 }),
  body('states.*.lgas').optional().isArray(),
  body('states.*.lgas.*.name').optional().isString().trim(),
  body('states.*.lgas.*.price').optional().isFloat({ min: 0 }),
  body('states.*.lgas.*.etaDays').optional().isInt({ min: 0 }),
];
