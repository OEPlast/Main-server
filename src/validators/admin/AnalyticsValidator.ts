import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';
import { parseAnalyticsDate } from '@/helpers/dateParser';

/**
 * Statistics fields `/chart-data` is allowed to aggregate.
 *
 * The controller interpolates this value straight into an aggregation expression
 * (`{ $sum: '$' + metric }`), so it has to be an allowlist rather than a type
 * check. It was unguarded for as long as the validator below never ran.
 */
const STATISTICS_METRICS = [
  'totalAmount',
  'totalRevenue',
  'totalCustomers',
  'totalSales',
  'totalOrders',
  'totalReturns',
] as const;

const GROUP_BY_VALUES = ['days', 'weeks', 'months', 'years'] as const;

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

export const validateAnalyticsQuery = [
  // Spread here rather than nesting the chain: `checkSchema` returns a
  // `RunnableValidationChains` object, which Express's types reject inside an
  // array. Spreading flattens it to plain `ValidationChain` handlers, so the 98
  // existing `router.get(..., validateAnalyticsQuery, ...)` registrations keep
  // working untouched.
  ...checkSchema({
    from: {
      in: ['query'],
      isISO8601: true,
      errorMessage: 'The "from" query parameter is required and must be a valid ISO8601 date.',
    },
    to: {
      in: ['query'],
      isISO8601: true,
      errorMessage: 'The "to" query parameter is required and must be a valid ISO8601 date.',
      custom: {
        options: (value: string, { req }) => {
          const from = req.query?.from;
          if (typeof from !== 'string' || typeof value !== 'string') return true;

          try {
            // Compared through the same parser the controllers use, so "2026-03"
            // as a `to` means end-of-March here too rather than the 1st.
            const parsedFrom = parseAnalyticsDate(from, 'from');
            const parsedTo = parseAnalyticsDate(value, 'to');

            // An unparseable bound is already reported by that field's own rule.
            // Failing here too would add a misleading "to is before from" on top.
            if (isNaN(parsedFrom.getTime()) || isNaN(parsedTo.getTime())) return true;

            return parsedTo >= parsedFrom;
          } catch {
            return true;
          }
        },
        errorMessage: 'The "to" date must be on or after the "from" date.',
      },
    },
    groupBy: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [GROUP_BY_VALUES],
      },
      errorMessage: `The "groupBy" query parameter must be one of: ${GROUP_BY_VALUES.join(', ')}.`,
    },
    page: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      toInt: true,
      errorMessage: 'The "page" query parameter must be a positive integer.',
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1, max: 100 } },
      toInt: true,
      errorMessage: 'The "limit" query parameter must be an integer between 1 and 100.',
    },
    metric: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [STATISTICS_METRICS],
      },
      errorMessage: `The "metric" query parameter must be one of: ${STATISTICS_METRICS.join(', ')}.`,
    },
  }),
  handleValidationErrors,
];

export { handleValidationErrors };
