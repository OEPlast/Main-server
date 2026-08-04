import type { PipelineStage } from 'mongoose';
import { DEFAULT_TIMEZONE, isValidTimezone } from '@/config/timezone';
import type { CustomResponsePromise } from '@/types';
import type { BucketRow } from './buckets';
import { densify } from './buckets';
import type { DimensionDefinition } from './dimensions';
import { DIMENSION_KEYS, getDimension } from './dimensions';
import type { GranularityRequest, GranularitySpec } from './granularity';
import { GranularityTooFineError, resolveGranularity, truncExpr } from './granularity';
import type { MetricDefinition } from './metrics';
import { METRICS, getMetric } from './metrics';
import {
  buildDimensionedSeriesPipeline,
  buildSeriesPipeline,
  buildTotalPipeline,
  buildUnstampedPipeline,
  canBeUnstamped,
  emptyValue,
  isStock,
  matchStage,
} from './pipeline';
import type { ComparisonMode, TimeWindow } from './range';
import { RangeError, changePct, comparisonWindow, resolveWindow, spanMs, toZonedIso } from './range';
import { getSourceModel } from './sources';

/**
 * The analytics query engine.
 *
 * **This module is the only consumer of `METRICS`.** That is the whole design:
 * before it existed, the registry declared which timestamp each metric was
 * measured on and nothing enforced it, while ~99 hand-written aggregations each
 * made that choice independently. Every number the API returns now comes through
 * here, so a metric and the rule describing it cannot disagree.
 */

/** At most 8 metrics per request — enough for any dashboard row, bounded enough to stay fast. */
export const MAX_METRICS_PER_REQUEST = 8;

export interface EngineQuery {
  metrics: string[];
  from?: string;
  to?: string;
  preset?: string;
  granularity?: GranularityRequest;
  tz?: string;
  compare?: ComparisonMode;
  dimension?: string;
  now?: Date;
}

export interface SeriesRow extends BucketRow {
  [metricKey: string]: unknown;
}

export interface SeriesResult {
  granularity: string;
  granularityRequested: GranularityRequest;
  timezone: string;
  from: string;
  to: string;
  bucketCount: number;
  metrics: string[];
  /** Present only on a dimensioned series. */
  dimension?: string;
  /** Column keys of a dimensioned series, in display order. */
  seriesKeys?: Array<{ key: string; label: string }>;
  series: SeriesRow[];
  totals: Record<string, number | null>;
  comparison: {
    from: string;
    to: string;
    totals: Record<string, number | null>;
    changePct: Record<string, number | null>;
  } | null;
  unstamped: Record<string, number>;
  computedAt: string;
}

export interface SummaryResult {
  timezone: string;
  from: string;
  to: string;
  metrics: string[];
  totals: Record<string, number | null>;
  comparison: {
    from: string;
    to: string;
    totals: Record<string, number | null>;
    changePct: Record<string, number | null>;
  } | null;
  unstamped: Record<string, number>;
  computedAt: string;
}

export interface BreakdownRow {
  key: string;
  label: string;
  value: number;
  share: number | null;
}

export interface BreakdownResult {
  metric: string;
  dimension: string;
  timezone: string;
  from: string;
  to: string;
  total: number | null;
  rows: BreakdownRow[];
  computedAt: string;
}

class QueryError extends Error {
  constructor(
    message: string,
    public readonly code = 400
  ) {
    super(message);
    this.name = 'QueryError';
  }
}

/** Resolve and validate everything a query needs, or throw a 400-shaped error. */
const resolveContext = (query: EngineQuery, needsGranularity: boolean) => {
  const timezone = query.tz ?? DEFAULT_TIMEZONE;

  if (!isValidTimezone(timezone)) {
    throw new QueryError(`"${timezone}" is not a valid IANA timezone.`);
  }

  const keys = [...new Set(query.metrics.map((k) => k.trim()).filter(Boolean))];

  if (keys.length === 0) {
    throw new QueryError(
      `At least one metric is required. Valid metrics: ${Object.keys(METRICS).join(', ')}.`
    );
  }

  if (keys.length > MAX_METRICS_PER_REQUEST) {
    throw new QueryError(
      `At most ${MAX_METRICS_PER_REQUEST} metrics per request; ${keys.length} were requested.`
    );
  }

  const definitions = keys.map((key) => {
    const def = getMetric(key);
    if (!def) {
      // The registry is the schema, so the error can name every valid key
      // without a second list that would drift out of date.
      throw new QueryError(
        `Unknown metric "${key}". Valid metrics: ${Object.keys(METRICS).join(', ')}.`
      );
    }
    return def;
  });

  const window = resolveWindow({
    preset: query.preset,
    from: query.from,
    to: query.to,
    timezone,
    now: query.now,
  });

  const span = spanMs(window);
  const resolution = needsGranularity
    ? resolveGranularity(span, query.granularity ?? 'auto')
    : null;

  return { timezone, keys, definitions, window, resolution };
};

const toQueryError = (error: unknown): QueryError => {
  if (error instanceof QueryError) return error;
  if (error instanceof RangeError || error instanceof GranularityTooFineError) {
    return new QueryError(error.message);
  }
  return new QueryError(
    error instanceof Error ? error.message : 'Analytics query failed',
    500
  );
};

/** One metric's window total. `avg` metrics return null on an empty window, not 0. */
const runTotal = async (def: MetricDefinition, window: TimeWindow): Promise<number | null> => {
  const model = getSourceModel(def.source);
  const [row] = await model.aggregate(buildTotalPipeline(def, window));
  const value = row?.value;

  if (value === undefined || value === null) return emptyValue(def);
  return value as number;
};

const runTotals = async (
  definitions: MetricDefinition[],
  window: TimeWindow
): Promise<Record<string, number | null>> => {
  const values = await Promise.all(definitions.map((def) => runTotal(def, window)));

  return Object.fromEntries(definitions.map((def, i) => [def.key, values[i]]));
};

/**
 * How many documents belong to this window but carry no event stamp.
 *
 * Reported rather than hidden. `completions` read near-zero across all history
 * until `completedAt` was backfilled, and without this number that looks like a
 * business fact instead of a data gap.
 */
const runUnstamped = async (
  definitions: MetricDefinition[],
  window: TimeWindow
): Promise<Record<string, number>> => {
  const applicable = definitions.filter(canBeUnstamped);

  const counts = await Promise.all(
    applicable.map(async (def) => {
      const model = getSourceModel(def.source);
      const [row] = await model.aggregate(buildUnstampedPipeline(def, window));
      return (row?.value as number) ?? 0;
    })
  );

  return Object.fromEntries(
    applicable.map((def, i) => [def.key, counts[i]]).filter(([, count]) => (count as number) > 0)
  );
};

const runComparison = async (
  definitions: MetricDefinition[],
  window: TimeWindow,
  spec: GranularitySpec,
  timezone: string,
  mode: ComparisonMode,
  currentTotals: Record<string, number | null>
) => {
  const previous = comparisonWindow(window, mode, spec, timezone);
  if (!previous) return null;

  // Stock metrics ignore the window, so a "previous period" value would be the
  // same number and imply 0% change where no comparison exists at all.
  const comparable = definitions.filter((def) => !isStock(def));
  if (comparable.length === 0) return null;

  const totals = await runTotals(comparable, previous);

  return {
    from: toZonedIso(previous.from, timezone),
    to: toZonedIso(previous.to, timezone),
    totals,
    changePct: Object.fromEntries(
      comparable.map((def) => [
        def.key,
        changePct(Number(currentTotals[def.key] ?? 0), Number(totals[def.key] ?? 0)),
      ])
    ),
  };
};

/**
 * Bucketed time series for up to 8 metrics.
 *
 * Metrics run as separate pipelines in parallel rather than through `$facet`.
 * `$facet` cannot cross collections, and even within one collection each metric
 * ranges on a *different* timestamp field, so a shared prefix match would have to
 * be an `$or` across fields that no index serves. Separate pipelines each get a
 * tight single-field match on their own index.
 */
export const runSeries = async (query: EngineQuery): CustomResponsePromise<SeriesResult> => {
  try {
    const { timezone, keys, definitions, window, resolution } = resolveContext(query, true);
    const spec = (resolution as { spec: GranularitySpec }).spec;

    // A stock metric has no time dimension, so it cannot appear on a series.
    // Rejected explicitly rather than returned as a flat line, which would imply
    // the value was measured in each bucket when it was measured once, now.
    const stockKeys = definitions.filter(isStock).map((def) => def.key);
    if (stockKeys.length > 0) {
      throw new QueryError(
        `${stockKeys.join(', ')} ${stockKeys.length === 1 ? 'is a stock metric and has' : 'are stock metrics and have'} no time series. ` +
          'Request them from /summary instead.'
      );
    }

    /**
     * Dimensioned series — one column per category, e.g. transactions by status
     * over time. Restricted to a single metric because the response is already
     * wide over categories; crossing that with several metrics produces a column
     * set nobody can read.
     */
    if (query.dimension && query.dimension !== 'none') {
      // Awaited, not returned bare: a bare `return promise` inside `try` escapes
      // this function's catch, so a validation failure would surface as an
      // unhandled rejection instead of a 400.
      return await runDimensionedSeries(query, {
        timezone,
        definitions,
        window,
        spec,
      });
    }

    const perMetric = await Promise.all(
      definitions.map(async (def) => {
        const model = getSourceModel(def.source);
        const rows = (await model.aggregate(
          buildSeriesPipeline(def, window, spec, timezone)
        )) as Array<{ bucketStart: Date; value: number }>;

        return densify(rows, window, spec, timezone, emptyValue(def));
      })
    );

    // Wide rows — one column per metric. Recharts consumes wide arrays directly;
    // long form would force a pivot in every chart component.
    const spine = perMetric[0] ?? [];
    const series: SeriesRow[] = spine.map((bucket, index) => {
      const row: SeriesRow = {
        bucket: bucket.bucket,
        bucketLabel: bucket.bucketLabel,
        bucketStart: bucket.bucketStart,
      };

      definitions.forEach((def, metricIndex) => {
        row[def.key] = perMetric[metricIndex][index]?.value ?? emptyValue(def);
      });

      return row;
    });

    const totals = await runTotals(definitions, window);
    const [comparison, unstamped] = await Promise.all([
      runComparison(definitions, window, spec, timezone, query.compare ?? 'none', totals),
      runUnstamped(definitions, window),
    ]);

    return {
      message: 'Series fetched successfully',
      data: {
        granularity: spec.granularity,
        granularityRequested: query.granularity ?? 'auto',
        timezone,
        from: toZonedIso(window.from, timezone),
        to: toZonedIso(window.to, timezone),
        bucketCount: series.length,
        metrics: keys,
        series,
        totals,
        comparison,
        unstamped,
        computedAt: new Date().toISOString(),
      },
      code: 200,
    };
  } catch (error) {
    const queryError = toQueryError(error);
    if (queryError.code === 500) console.error('Error in runSeries:', error);
    return { message: queryError.message, data: null, code: queryError.code };
  }
};

/** Cap on distinct categories in a dimensioned series — beyond this a chart is unreadable. */
const MAX_SERIES_CATEGORIES = 12;

/**
 * One metric, bucketed and split by a dimension.
 *
 * Returns wide rows keyed `<metric>__<category>` so the response stays flat and
 * Recharts can stack it directly, and lists the categories it found in
 * `seriesKeys` — the client renders whatever came back rather than hardcoding a
 * status list that drifts when a new status is added.
 */
const runDimensionedSeries = async (
  query: EngineQuery,
  ctx: {
    timezone: string;
    definitions: MetricDefinition[];
    window: TimeWindow;
    spec: GranularitySpec;
  }
): CustomResponsePromise<SeriesResult> => {
  const { timezone, definitions, window, spec } = ctx;

  if (definitions.length > 1) {
    throw new QueryError(
      'A dimensioned series supports exactly one metric; request the others separately.'
    );
  }

  const def = definitions[0];
  const dimension = getDimension(query.dimension as string);

  if (!dimension) {
    throw new QueryError(
      `Unknown dimension "${query.dimension}". Valid dimensions: ${DIMENSION_KEYS.join(', ')}.`
    );
  }

  if (!dimension.sources.includes(def.source)) {
    throw new QueryError(
      `Dimension "${dimension.key}" does not apply to metric "${def.key}" (source: ${def.source}).`
    );
  }

  const model = getSourceModel(def.source);
  const rows = (await model.aggregate(
    buildDimensionedSeriesPipeline(def, dimension, window, spec, timezone)
  )) as Array<{ bucketStart: Date; dim: unknown; value: number }>;

  const categories = orderCategories(
    [...new Set(rows.map((row) => String(row.dim ?? 'unknown')))],
    dimension
  ).slice(0, MAX_SERIES_CATEGORIES);

  // Densify each category independently so every column has a value in every
  // bucket — a stacked chart with holes misreads as a dip rather than a gap.
  const perCategory = categories.map((category) =>
    densify(
      rows
        .filter((row) => String(row.dim ?? 'unknown') === category)
        .map((row) => ({ bucketStart: row.bucketStart, value: row.value })),
      window,
      spec,
      timezone,
      emptyValue(def)
    )
  );

  const spine = perCategory[0] ?? densify([], window, spec, timezone, emptyValue(def));

  const series: SeriesRow[] = spine.map((bucket, index) => {
    const row: SeriesRow = {
      bucket: bucket.bucket,
      bucketLabel: bucket.bucketLabel,
      bucketStart: bucket.bucketStart,
    };

    categories.forEach((category, categoryIndex) => {
      row[`${def.key}__${category}`] = perCategory[categoryIndex][index]?.value ?? emptyValue(def);
    });

    return row;
  });

  const totals = await runTotals(definitions, window);
  const unstamped = await runUnstamped(definitions, window);

  return {
    message: 'Series fetched successfully',
    data: {
      granularity: spec.granularity,
      granularityRequested: query.granularity ?? 'auto',
      timezone,
      from: toZonedIso(window.from, timezone),
      to: toZonedIso(window.to, timezone),
      bucketCount: series.length,
      metrics: [def.key],
      dimension: dimension.key,
      seriesKeys: categories.map((category) => ({
        key: `${def.key}__${category}`,
        label: category,
      })),
      series,
      totals,
      comparison: null,
      unstamped,
      computedAt: new Date().toISOString(),
    },
    code: 200,
  };
};

/**
 * Stages that turn a grouping key into a display label.
 *
 * Empty when the dimension groups by something already human-readable — an order
 * status is its own label; a product ObjectId is not.
 */
const labelLookupStages = (dimension: DimensionDefinition): PipelineStage[] => {
  if (!dimension.labelLookup) return [];

  const { from, fields } = dimension.labelLookup;

  return [
    {
      $lookup: {
        from,
        localField: '_id',
        foreignField: '_id',
        as: '__label',
        pipeline: [{ $project: Object.fromEntries(fields.map((f) => [f, 1])) }],
      },
    } as PipelineStage,
    {
      $set: {
        label: {
          $let: {
            vars: { doc: { $arrayElemAt: ['$__label', 0] } },
            in: {
              $trim: {
                input: {
                  $reduce: {
                    input: fields.map((f) => ({ $ifNull: [`$$doc.${f}`, ''] })),
                    initialValue: '',
                    in: { $concat: ['$$value', ' ', '$$this'] },
                  },
                },
              },
            },
          },
        },
      },
    } as PipelineStage,
  ];
};

/**
 * Categories in their declared order where one exists.
 *
 * Sentiment reads positive → neutral → negative, and ratings read 1→5; sorting
 * those by volume produces a legend nobody can scan.
 */
const orderCategories = (found: string[], dimension: DimensionDefinition): string[] => {
  if (!dimension.order) return found.sort();

  const ranked = dimension.order.filter((key) => found.includes(key));
  const rest = found.filter((key) => !dimension.order!.includes(key)).sort();

  return [...ranked, ...rest];
};

/** Scalars and deltas, with no bucketing — what stat cards and overview rows need. */
export const runSummary = async (query: EngineQuery): CustomResponsePromise<SummaryResult> => {
  try {
    const { timezone, keys, definitions, window } = resolveContext(query, false);

    const totals = await runTotals(definitions, window);

    // Comparison shifts by calendar units, so it still needs a granularity even
    // though no series is produced. Derived from the span, never from the caller.
    const { spec } = resolveGranularity(spanMs(window), 'auto');

    const [comparison, unstamped] = await Promise.all([
      runComparison(definitions, window, spec, timezone, query.compare ?? 'none', totals),
      runUnstamped(definitions, window),
    ]);

    return {
      message: 'Summary fetched successfully',
      data: {
        timezone,
        from: toZonedIso(window.from, timezone),
        to: toZonedIso(window.to, timezone),
        metrics: keys,
        totals,
        comparison,
        unstamped,
        computedAt: new Date().toISOString(),
      },
      code: 200,
    };
  } catch (error) {
    const queryError = toQueryError(error);
    if (queryError.code === 500) console.error('Error in runSummary:', error);
    return { message: queryError.message, data: null, code: queryError.code };
  }
};

export interface BreakdownQuery extends Omit<EngineQuery, 'metrics'> {
  metric: string;
  dimension: string;
  limit?: number;
}

/** One metric split by one dimension, ranked, with each row's share of the total. */
export const runBreakdown = async (
  query: BreakdownQuery
): CustomResponsePromise<BreakdownResult> => {
  try {
    const { timezone, definitions, window } = resolveContext(
      { ...query, metrics: [query.metric] },
      false
    );

    const def = definitions[0];
    const dimension = getDimension(query.dimension);

    if (!dimension) {
      throw new QueryError(
        `Unknown dimension "${query.dimension}". Valid dimensions: ${DIMENSION_KEYS.join(', ')}.`
      );
    }

    if (!dimension.sources.includes(def.source)) {
      throw new QueryError(
        `Dimension "${dimension.key}" does not apply to metric "${def.key}" ` +
          `(source: ${def.source}).`
      );
    }

    const limit = Math.min(Math.max(query.limit ?? 10, 1), 100);
    const model = getSourceModel(def.source);

    const pipeline: PipelineStage[] = [
      matchStage(def, window),
      ...((dimension.stages ?? []) as PipelineStage[]),
      {
        $group: {
          _id: dimension.field,
          value: buildGroupAccumulator(def, dimension),
        },
      } as PipelineStage.Group,
      // `distinct` accumulates a set; collapse it before sorting, or the sort
      // would order by array rather than by cardinality.
      ...(def.aggregation === 'distinct'
        ? [{ $set: { value: { $size: '$value' } } } as PipelineStage]
        : []),
      { $sort: { value: -1 } },
      { $limit: limit },
      // Label resolution runs here, after the limit — looking up every distinct
      // key in the window to display ten of them would be wasted work.
      ...labelLookupStages(dimension),
      { $project: { _id: 0, key: '$_id', value: 1, label: 1 } },
    ];

    const raw = (await model.aggregate(pipeline)) as Array<{
      key: unknown;
      value: number;
      label?: string;
    }>;

    // Ranked by value by default, but a dimension with a natural order (ratings
    // 1–5, sentiment positive→negative) keeps it: a legend running 5, 3, 4 is
    // technically sorted and practically unreadable.
    const rows = dimension.order
      ? [...raw].sort((a, b) => {
          const rank = (key: unknown) => {
            const index = dimension.order!.indexOf(String(key ?? 'unknown'));
            return index === -1 ? Number.MAX_SAFE_INTEGER : index;
          };
          return rank(a.key) - rank(b.key);
        })
      : raw;

    const total = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);

    return {
      message: 'Breakdown fetched successfully',
      data: {
        metric: def.key,
        dimension: dimension.key,
        timezone,
        from: toZonedIso(window.from, timezone),
        to: toZonedIso(window.to, timezone),
        total,
        rows: rows.map((row) => ({
          key: String(row.key ?? 'unknown'),
          // Resolved label where the dimension provides one; otherwise the key
          // is already the label (a status, a payment method, a country).
          label: row.label?.trim() || String(row.key ?? 'Unknown'),
          value: row.value ?? 0,
          // Share of the returned rows, not of all-time — stated so a truncated
          // top-10 cannot be read as the whole picture.
          share: total ? Number((((row.value ?? 0) / total) * 100).toFixed(2)) : null,
        })),
        computedAt: new Date().toISOString(),
      },
      code: 200,
    };
  } catch (error) {
    const queryError = toQueryError(error);
    if (queryError.code === 500) console.error('Error in runBreakdown:', error);
    return { message: queryError.message, data: null, code: queryError.code };
  }
};

/**
 * Accumulator for a breakdown group.
 *
 * When a dimension unwinds line items, the document is no longer one order, so a
 * metric that sums `total` would count the whole order total once per line. In
 * that case sum the line's own value instead.
 */
const buildGroupAccumulator = (
  def: MetricDefinition,
  dimension: DimensionDefinition
): Record<string, unknown> => {
  if (dimension.rescopesValue && def.aggregation === 'sum') {
    return { $sum: { $multiply: ['$products.price', { $ifNull: ['$products.qty', 1] }] } };
  }

  if (dimension.rescopesValue && def.aggregation === 'count') {
    return { $sum: { $ifNull: ['$products.qty', 1] } };
  }

  switch (def.aggregation) {
    case 'count':
      return { $sum: 1 };
    case 'sum':
      return { $sum: `$${def.valueField}` };
    case 'avg':
      return { $avg: `$${def.valueField}` };
    case 'distinct':
      return { $addToSet: `$${def.valueField}` };
    default:
      return { $sum: 1 };
  }
};

/** Everything the API can be asked for — powers metric pickers and validation messages. */
export const getAnalyticsMeta = () => ({
  metrics: Object.values(METRICS).map((def) => ({
    key: def.key,
    label: def.label,
    group: def.group,
    kind: def.kind ?? 'flow',
    source: def.source,
    aggregation: def.aggregation,
    timestampField: def.timestampField,
    note: def.note ?? null,
  })),
  dimensions: DIMENSION_KEYS.map((key) => {
    const dimension = getDimension(key) as DimensionDefinition;
    return { key: dimension.key, label: dimension.label, sources: dimension.sources };
  }),
  defaultTimezone: DEFAULT_TIMEZONE,
  maxMetricsPerRequest: MAX_METRICS_PER_REQUEST,
});

export { truncExpr };
