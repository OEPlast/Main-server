import type { Request, Response } from 'express';
import type { ComparisonMode } from '@/services/admin/analytics/range';
import type { GranularityRequest } from '@/services/admin/analytics/granularity';
import {
  getAnalyticsMeta,
  runBreakdown,
  runSeries,
  runSummary,
} from '@/services/admin/analytics/engine';
import { runProductPerformance } from '@/services/admin/analytics/productPerformance';
import SettingsService from '@/services/SettingsService';
import { DEFAULT_TIMEZONE } from '@/config/timezone';

/**
 * Query-engine endpoints.
 *
 * Deliberately a new file rather than 4 more handlers appended to the 1,548-line
 * `AnalyticsController`: everything in that file is scheduled for deletion once
 * the pages have migrated, and keeping the replacement separate makes that a
 * clean cut instead of a careful extraction.
 *
 * Unlike the legacy handlers, these do not emit `{ error: 'Something went
 * wrong' }` on failure — every response, success or not, is the standard
 * `{ message, data }` envelope so the client has exactly one shape to parse.
 */

/**
 * The reporting timezone, resolved once per request.
 *
 * Explicit `?tz=` wins so an admin can inspect another market's day boundaries
 * ad hoc; otherwise the store's configured zone; otherwise the default. Settings
 * failures fall back rather than erroring — a missing settings row should not
 * take the dashboard down.
 */
const resolveTimezone = async (req: Request): Promise<string> => {
  const requested = req.query.tz;
  if (typeof requested === 'string' && requested.length > 0) return requested;

  try {
    const { data } = await SettingsService.getSettings();
    return data?.timezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

const parseMetrics = (value: unknown): string[] =>
  typeof value === 'string' ? value.split(',').map((key) => key.trim()).filter(Boolean) : [];

const getSeries = async (req: Request, res: Response) => {
  const { metrics, from, to, preset, granularity, compare, dimension } = req.query;

  const { data, code, message } = await runSeries({
    metrics: parseMetrics(metrics),
    from: from as string | undefined,
    to: to as string | undefined,
    preset: preset as string | undefined,
    granularity: granularity as GranularityRequest | undefined,
    compare: compare as ComparisonMode | undefined,
    dimension: dimension as string | undefined,
    tz: await resolveTimezone(req),
  });

  return res.status(code).json({ message, data });
};

const getSummary = async (req: Request, res: Response) => {
  const { metrics, from, to, preset, compare } = req.query;

  const { data, code, message } = await runSummary({
    metrics: parseMetrics(metrics),
    from: from as string | undefined,
    to: to as string | undefined,
    preset: preset as string | undefined,
    compare: compare as ComparisonMode | undefined,
    tz: await resolveTimezone(req),
  });

  return res.status(code).json({ message, data });
};

const getBreakdown = async (req: Request, res: Response) => {
  const { metric, dimension, from, to, preset, limit } = req.query;

  const { data, code, message } = await runBreakdown({
    metric: metric as string,
    dimension: dimension as string,
    from: from as string | undefined,
    to: to as string | undefined,
    preset: preset as string | undefined,
    limit: limit ? Number(limit) : undefined,
    tz: await resolveTimezone(req),
  });

  return res.status(code).json({ message, data });
};

/**
 * The registry, as data.
 *
 * Lets the admin render a metric picker from the same source the engine queries
 * from, instead of hand-duplicating the list, and is the seam role-scoped
 * analytics plugs into later — filter here and the UI hides rather than errors.
 */
const getMeta = async (req: Request, res: Response) => {
  return res.status(200).json({
    message: 'Analytics metadata fetched successfully',
    data: { ...getAnalyticsMeta(), timezone: await resolveTimezone(req) },
  });
};

/**
 * Everything about one product.
 *
 * Not part of the query engine — see `productPerformance.ts` for why, and for
 * which definitions it duplicates from the registry on purpose.
 */
const getProductPerformance = async (req: Request, res: Response) => {
  const { from, to, preset, granularity } = req.query;

  const { data, code, message } = await runProductPerformance({
    productId: req.params.productId,
    from: from as string | undefined,
    to: to as string | undefined,
    preset: preset as string | undefined,
    granularity: granularity as GranularityRequest | undefined,
    tz: await resolveTimezone(req),
  });

  return res.status(code).json({ message, data });
};

const Admin_AnalyticsQueryController = {
  getSeries,
  getSummary,
  getBreakdown,
  getMeta,
  getProductPerformance,
};

export default Admin_AnalyticsQueryController;
