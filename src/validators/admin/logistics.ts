import { body, param } from 'express-validator';

export const upsertConfigValidator = [
  body('countryCode').isString().trim().isLength({ min: 2, max: 3 }),
  body('countryName').isString().trim().isLength({ min: 2 }),
  body('states').isArray(),
  body('states.*.name').isString().trim(),
  body('states.*.code').isString().trim(),
  body('states.*.fallbackPrice').optional().isFloat({ min: 0 }),
  body('states.*.fallbackEtaDays').optional().isInt({ min: 0 }),
  body('states.*.cities').optional().isArray(),
  body('states.*.cities.*.name').optional().isString().trim(),
  body('states.*.cities.*.code').optional().isString().trim(),
  body('states.*.cities.*.price').optional().isFloat({ min: 0 }),
  body('states.*.cities.*.etaDays').optional().isInt({ min: 0 }),
  body('states.*.lgas').optional().isArray(),
  body('states.*.lgas.*.name').optional().isString().trim(),
  body('states.*.lgas.*.code').optional().isString().trim(),
  body('states.*.lgas.*.price').optional().isFloat({ min: 0 }),
  body('states.*.lgas.*.etaDays').optional().isInt({ min: 0 }),
];

export const getByCountryValidator = [param('countryCode').isString().trim().isLength({ min: 2, max: 3 })];

export const createEmptyCountryValidator = [
  body('countryCode').isString().trim().isLength({ min: 2, max: 3 }),
  body('countryName').isString().trim().isLength({ min: 2 }),
];

export const deleteCountryValidator = [param('countryCode').isString().trim().isLength({ min: 2, max: 3 })];

export const updateCountryNameValidator = [
  param('countryCode').isString().trim().isLength({ min: 2, max: 3 }),
  body('countryName').isString().trim().isLength({ min: 2 }),
];
