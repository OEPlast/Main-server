/**
 * Bucket granularity.
 *
 * Two problems this module exists to solve, both of which the previous analytics
 * layer had:
 *
 *   1. **No sub-day bucket existed at all**, so "the last ten minutes" was not
 *      expressible no matter how the question was phrased.
 *   2. **Granularity was chosen by the caller and never sanity-checked**, so a
 *      five-year range asked for daily buckets and got 1,826 points.
 *
 * MongoDB 8.0's `$dateTrunc` takes both `binSize` and `timezone`, so every
 * granularity below — including the sub-day ones — is one operator with
 * different arguments, cut on boundaries in the store's zone rather than UTC.
 */

export type GranularityUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export type Granularity =
  | 'minute'
  | 'five_minutes'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

/** `auto` asks the ladder below to pick; anything else is an explicit request. */
export type GranularityRequest = Granularity | 'auto';

export interface GranularitySpec {
  granularity: Granularity;
  unit: GranularityUnit;
  binSize: number;
}

/**
 * Monday.
 *
 * `$dateTrunc` defaults to Sunday. Retail weeks here run Monday to Sunday, and
 * this single constant is what makes "this week" mean the same thing in every
 * metric — a per-metric choice would guarantee two charts disagreeing.
 */
export const WEEK_START = 'monday' as const;

/**
 * Hard ceiling on buckets in one response.
 *
 * Past a few hundred points a chart stops being readable and the payload starts
 * to matter, so an explicit granularity that would exceed this is rejected with
 * a message naming a workable alternative rather than silently downgraded —
 * silently changing what was asked for is how a chart ends up mislabelled.
 */
export const MAX_BUCKETS = 500;

const SPECS: Record<Granularity, { unit: GranularityUnit; binSize: number }> = {
  minute: { unit: 'minute', binSize: 1 },
  five_minutes: { unit: 'minute', binSize: 5 },
  hour: { unit: 'hour', binSize: 1 },
  day: { unit: 'day', binSize: 1 },
  week: { unit: 'week', binSize: 1 },
  month: { unit: 'month', binSize: 1 },
  quarter: { unit: 'quarter', binSize: 1 },
  year: { unit: 'year', binSize: 1 },
};

export const GRANULARITIES = Object.keys(SPECS) as Granularity[];

export const isGranularity = (value: unknown): value is Granularity =>
  typeof value === 'string' && value in SPECS;

export const getGranularitySpec = (granularity: Granularity): GranularitySpec => ({
  granularity,
  ...SPECS[granularity],
});

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * The auto ladder: span → granularity, chosen so the worst case stays legible.
 *
 * The 30-minute step matters more than it looks. AD-2 recommended five minutes
 * as the smallest bucket, but a ten-minute window at five-minute bins is two
 * points, which is not a chart. Minute bins below half an hour, five-minute bins
 * up to six hours.
 */
const LADDER: Array<{ maxSpanMs: number; granularity: Granularity }> = [
  { maxSpanMs: 30 * MINUTE, granularity: 'minute' },
  { maxSpanMs: 6 * HOUR, granularity: 'five_minutes' },
  { maxSpanMs: 3 * DAY, granularity: 'hour' },
  { maxSpanMs: 120 * DAY, granularity: 'day' },
  { maxSpanMs: 730 * DAY, granularity: 'week' },
  { maxSpanMs: 3650 * DAY, granularity: 'month' },
];

export const autoGranularity = (spanMs: number): Granularity => {
  const step = LADDER.find((entry) => spanMs <= entry.maxSpanMs);
  return step ? step.granularity : 'year';
};

/**
 * Approximate bucket count for a span. Used only to enforce {@link MAX_BUCKETS},
 * so calendar drift (28–31 day months) does not matter — the estimate is
 * deliberately conservative rather than exact.
 */
export const estimateBucketCount = (spanMs: number, spec: GranularitySpec): number => {
  const APPROX_MS: Record<GranularityUnit, number> = {
    minute: MINUTE,
    hour: HOUR,
    day: DAY,
    week: 7 * DAY,
    month: 28 * DAY,
    quarter: 90 * DAY,
    year: 365 * DAY,
  };

  const bucketMs = APPROX_MS[spec.unit] * spec.binSize;
  return Math.ceil(spanMs / bucketMs) + 1;
};

export interface GranularityResolution {
  spec: GranularitySpec;
  requested: GranularityRequest;
  estimatedBuckets: number;
}

export class GranularityTooFineError extends Error {
  constructor(
    public readonly requested: Granularity,
    public readonly estimatedBuckets: number,
    public readonly suggestion: Granularity
  ) {
    super(
      `Granularity "${requested}" over this range produces about ${estimatedBuckets} buckets, ` +
        `over the ${MAX_BUCKETS} limit. Use granularity=${suggestion} or granularity=auto.`
    );
    this.name = 'GranularityTooFineError';
  }
}

/**
 * Resolve the granularity actually used for a window.
 *
 * `auto` walks the ladder. An explicit value is honoured unless it would blow the
 * bucket cap, in which case it throws — the caller turns that into a 400 naming
 * the granularity that would work.
 */
export const resolveGranularity = (
  spanMs: number,
  requested: GranularityRequest = 'auto'
): GranularityResolution => {
  if (requested === 'auto') {
    const spec = getGranularitySpec(autoGranularity(spanMs));

    return {
      spec,
      requested,
      estimatedBuckets: estimateBucketCount(spanMs, spec),
    };
  }

  const spec = getGranularitySpec(requested);
  const estimatedBuckets = estimateBucketCount(spanMs, spec);

  if (estimatedBuckets > MAX_BUCKETS) {
    throw new GranularityTooFineError(requested, estimatedBuckets, autoGranularity(spanMs));
  }

  return { spec, requested, estimatedBuckets };
};

/**
 * `$dateTrunc` arguments for a field. The single place bucketing is defined —
 * every metric, series and breakdown routes through this, so a bucket boundary
 * cannot mean two different things in two different charts.
 */
export const truncExpr = (fieldPath: string, spec: GranularitySpec, timezone: string) => ({
  $dateTrunc: {
    date: fieldPath.startsWith('$') ? fieldPath : `$${fieldPath}`,
    unit: spec.unit,
    binSize: spec.binSize,
    timezone,
    ...(spec.unit === 'week' ? { startOfWeek: WEEK_START } : {}),
  },
});
