import { checkSchema, type Schema } from 'express-validator';
import { isValidTimezone } from '@/config/timezone';
import { DIMENSION_KEYS } from '@/services/admin/analytics/dimensions';
import { GRANULARITIES } from '@/services/admin/analytics/granularity';
import { COMPARISON_MODES, PRESETS } from '@/services/admin/analytics/range';
import { handleValidationErrors } from './AnalyticsValidator';

const GRANULARITY_VALUES = ['auto', ...GRANULARITIES];

const commonRangeSchema: Schema = {
  from: {
    in: ['query'],
    optional: true,
    isISO8601: true,
    errorMessage: 'The "from" query parameter must be a valid ISO8601 date.',
  },
  to: {
    in: ['query'],
    optional: true,
    isISO8601: true,
    errorMessage: 'The "to" query parameter must be a valid ISO8601 date.',
  },
  preset: {
    in: ['query'],
    optional: true,
    isIn: { options: [PRESETS] },
    errorMessage: `The "preset" query parameter must be one of: ${PRESETS.join(', ')}.`,
  },
  tz: {
    in: ['query'],
    optional: true,
    custom: { options: (value: unknown) => isValidTimezone(value) },
    errorMessage: 'The "tz" query parameter must be a valid IANA timezone (e.g., Africa/Lagos).',
  },
  compare: {
    in: ['query'],
    optional: true,
    isIn: { options: [COMPARISON_MODES] },
    errorMessage: `The "compare" query parameter must be one of: ${COMPARISON_MODES.join(', ')}.`,
  },
};

const metricsSchema: Schema = {
  metrics: {
    in: ['query'],
    isString: true,
    // Only checked as non-empty here. Which keys are valid is the registry's
    // business, and the engine's error names every one of them.
    notEmpty: true,
    errorMessage: 'The "metrics" query parameter is required (comma-separated metric keys).',
  },
};

export const validateSeriesQuery = [
  ...checkSchema({
    ...metricsSchema,
    ...commonRangeSchema,
    granularity: {
      in: ['query'],
      optional: true,
      isIn: { options: [GRANULARITY_VALUES] },
      errorMessage: `The "granularity" query parameter must be one of: ${GRANULARITY_VALUES.join(', ')}.`,
    },
    dimension: {
      in: ['query'],
      optional: true,
      isIn: { options: [[...DIMENSION_KEYS, 'none']] },
      errorMessage: `The "dimension" query parameter must be one of: ${DIMENSION_KEYS.join(', ')}.`,
    },
  }),
  handleValidationErrors,
];

export const validateSummaryQuery = [
  ...checkSchema({ ...metricsSchema, ...commonRangeSchema }),
  handleValidationErrors,
];

export const validateProductPerformanceQuery = [
  ...checkSchema({
    ...commonRangeSchema,
    productId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'The product id in the path must be a valid id.',
    },
    granularity: {
      in: ['query'],
      optional: true,
      isIn: { options: [GRANULARITY_VALUES] },
      errorMessage: `The "granularity" query parameter must be one of: ${GRANULARITY_VALUES.join(', ')}.`,
    },
  }),
  handleValidationErrors,
];

export const validateBreakdownQuery = [
  ...checkSchema({
    ...commonRangeSchema,
    metric: {
      in: ['query'],
      isString: true,
      notEmpty: true,
      errorMessage: 'The "metric" query parameter is required.',
    },
    dimension: {
      in: ['query'],
      isIn: { options: [DIMENSION_KEYS] },
      errorMessage: `The "dimension" query parameter must be one of: ${DIMENSION_KEYS.join(', ')}.`,
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1, max: 100 } },
      toInt: true,
      errorMessage: 'The "limit" query parameter must be an integer between 1 and 100.',
    },
  }),
  handleValidationErrors,
];
