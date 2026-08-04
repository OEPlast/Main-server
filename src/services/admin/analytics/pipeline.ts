import type { PipelineStage } from 'mongoose';
import type { GranularitySpec } from './granularity';
import { truncExpr } from './granularity';
import type { DimensionDefinition } from './dimensions';
import type { MetricDefinition } from './metrics';
import type { TimeWindow } from './range';

/**
 * `MetricDefinition` → aggregation pipeline.
 *
 * This is the only place a metric becomes a query. Every rule the registry
 * states is enforced here and nowhere else, which is what stops the registry
 * from decaying back into documentation.
 */

/**
 * A `$group` accumulator expression.
 *
 * Mongoose's own `AccumulatorOperator` union enumerates every operator including
 * ones like `$topN`, so a computed accumulator never satisfies it structurally.
 * The `$group` stages below are asserted to `PipelineStage.Group` for that
 * reason — the shape is correct, the union is just not open.
 */
type Accumulator = Record<string, unknown>;

/** The accumulator a metric's `aggregation`/`valueField` pair implies. */
const accumulator = (def: MetricDefinition): Accumulator => {
  switch (def.aggregation) {
    case 'count':
      return { $sum: 1 };
    case 'sum':
      if (!def.valueField) {
        throw new Error(`Metric "${def.key}" is a sum but declares no valueField.`);
      }
      return { $sum: `$${def.valueField}` };
    case 'avg':
      if (!def.valueField) {
        throw new Error(`Metric "${def.key}" is an average but declares no valueField.`);
      }
      return { $avg: `$${def.valueField}` };
    case 'distinct':
      if (!def.valueField) {
        throw new Error(`Metric "${def.key}" is a distinct count but declares no valueField.`);
      }
      // Accumulates the set; `sizeStage` below turns it into a number. Doing it
      // in two steps is what keeps the accumulator table uniform.
      return { $addToSet: `$${def.valueField}` };
    default: {
      const exhaustive: never = def.aggregation;
      throw new Error(`Unsupported aggregation "${exhaustive}" on metric "${def.key}".`);
    }
  }
};

/**
 * The time-window match.
 *
 * Ranging on the metric's own `timestampField` also excludes documents where
 * that stamp is null, which is the correct behaviour and not an accident: an
 * order cancelled before `cancelledAt` existed has no honest place on a timeline,
 * so it is reported through `meta.unstamped` instead of being dated to its
 * creation.
 */
export const matchStage = (def: MetricDefinition, window: TimeWindow): PipelineStage.Match => {
  // A stock metric counts what exists now, so applying a date range would answer
  // a different question — "products currently low on stock that were created
  // last month" is not what a low-stock figure means.
  if (isStock(def)) {
    return { $match: { ...(def.filter ?? {}) } };
  }

  return {
    $match: {
      [def.timestampField]: { $gte: window.from, $lte: window.to },
      ...(def.filter ?? {}),
    },
  };
};

export const isStock = (def: MetricDefinition): boolean => def.kind === 'stock';

/**
 * Collapses a `distinct` accumulator's set into its cardinality.
 *
 * Empty for every other aggregation, so callers can splice it in unconditionally
 * rather than branching around it.
 */
const sizeStage = (def: MetricDefinition): PipelineStage[] =>
  def.aggregation === 'distinct' ? [{ $set: { value: { $size: '$value' } } }] : [];

/** Bucketed series for one metric: `[{ bucketStart, value }]`, sparse. */
export const buildSeriesPipeline = (
  def: MetricDefinition,
  window: TimeWindow,
  spec: GranularitySpec,
  timezone: string
): PipelineStage[] => [
  matchStage(def, window),
  {
    $group: {
      _id: truncExpr(def.timestampField, spec, timezone),
      value: accumulator(def),
    },
  } as PipelineStage.Group,
  ...sizeStage(def),
  { $project: { _id: 0, bucketStart: '$_id', value: 1 } },
  { $sort: { bucketStart: 1 } },
];

/**
 * Bucketed series split by a dimension: `[{ bucketStart, dim, value }]`, sparse.
 *
 * This is what a stacked chart needs — "transactions by status over time",
 * "reviews by sentiment over time". The legacy layer built each of these as a
 * bespoke aggregation with the categories hardcoded in the `$group`, which is
 * why adding a status meant editing a pipeline.
 */
export const buildDimensionedSeriesPipeline = (
  def: MetricDefinition,
  dimension: DimensionDefinition,
  window: TimeWindow,
  spec: GranularitySpec,
  timezone: string
): PipelineStage[] => [
  matchStage(def, window),
  ...((dimension.stages ?? []) as PipelineStage[]),
  {
    $group: {
      _id: {
        bucketStart: truncExpr(def.timestampField, spec, timezone),
        dim: dimension.field,
      },
      value: accumulator(def),
    },
  } as PipelineStage.Group,
  ...sizeStage(def),
  { $project: { _id: 0, bucketStart: '$_id.bucketStart', dim: '$_id.dim', value: 1 } },
  { $sort: { bucketStart: 1 } },
];

/**
 * Window total for one metric, as a single scalar.
 *
 * Run as its own pass rather than reduced from the series. For `count` and `sum`
 * the two agree, but for `avg` they do not: the mean of daily averages is not the
 * average over the window unless every day has identical volume. AOV is the
 * metric where that difference is largest and most misleading.
 */
export const buildTotalPipeline = (
  def: MetricDefinition,
  window: TimeWindow
): PipelineStage[] => [
  matchStage(def, window),
  { $group: { _id: null, value: accumulator(def) } } as PipelineStage.Group,
  ...sizeStage(def),
  { $project: { _id: 0, value: 1 } },
];

/**
 * Counts documents that belong in the window by creation but carry no event
 * stamp, so the gap is reportable instead of silent.
 *
 * Without this, a `completions` chart reading zero across 2025 looks like a
 * business that completed no orders rather than a field that did not exist yet.
 */
export const buildUnstampedPipeline = (
  def: MetricDefinition,
  window: TimeWindow
): PipelineStage[] => [
  {
    $match: {
      [def.timestampField]: null,
      createdAt: { $gte: window.from, $lte: window.to },
      ...(def.filter ?? {}),
    },
  },
  { $count: 'value' },
];

/**
 * Whether "missing timestamp" is a reportable gap for this metric.
 *
 * Three cases where it is not:
 *
 *   - **Stock metrics** have no event timestamp to be missing.
 *   - **`createdAt` metrics** cannot be missing it; every document has one.
 *   - **Metrics with no `filter`** — and this is the subtle one. A gap is only a
 *     gap when something else proves the event occurred: `status: 'Cancelled'`
 *     with no `cancelledAt` is a genuine hole. But `deliveries` has no filter, so
 *     an order without `deliveredAt` was simply never delivered. Reporting those
 *     as "excluded" claimed 134 deliveries were missing from a figure that had
 *     correctly counted every delivery there was.
 */
export const canBeUnstamped = (def: MetricDefinition): boolean =>
  !isStock(def) && def.timestampField !== 'createdAt' && Boolean(def.filter);

/**
 * Zero for counts, sums and distinct counts; null for averages, where "no data"
 * is genuinely not the same statement as "zero".
 */
export const emptyValue = (def: MetricDefinition): number | null =>
  def.aggregation === 'avg' ? null : 0;
