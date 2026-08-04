import { DateTime } from 'luxon';
import type { GranularitySpec } from './granularity';
import { WEEK_START } from './granularity';
import type { TimeWindow } from './range';

/**
 * Dense bucket spines and labelling.
 *
 * ## Why gap filling happens here rather than in the aggregation
 *
 * `$densify` — which the legacy layer used 52 times — **has no `timezone`
 * option**. Its `range.unit` arithmetic is UTC, so a Lagos month bucket (the
 * instant `2026-02-28T23:00:00Z`) densifies to `2026-03-28T23:00:00Z`, which is
 * not a month boundary in any zone. It cannot be made correct outside UTC, so it
 * is not an option regardless of preference.
 *
 * Building the spine inside the pipeline with `$dateDiff`/`$dateAdd` would work,
 * but produces a `$group`/`$map`/`$filter` construction that is close to
 * unreadable and cannot be tested without a live database. Since bucket counts
 * are capped at 500, generating the spine here — with the same zoned calendar
 * arithmetic — is equivalent work, an order of magnitude clearer, and unit
 * testable in isolation.
 *
 * The merge is a **union**, not a lookup: any bucket Mongo returned that the
 * spine did not predict is appended rather than dropped. A spine bug should show
 * up as a stray point, never as silently missing revenue.
 */

/** Luxon's plural unit names, keyed by our singular ones. */
const LUXON_UNIT = {
  minute: 'minutes',
  hour: 'hours',
  day: 'days',
  week: 'weeks',
  month: 'months',
  quarter: 'quarters',
  year: 'years',
} as const;

const MS_PER_MINUTE = 60 * 1000;

/**
 * Truncate an instant to its bucket start, matching `$dateTrunc` semantics.
 *
 * For `binSize > 1` (only `five_minutes` today) bins are measured from the Unix
 * epoch, which is what MongoDB does for sub-day units. Lagos is a whole-hour
 * offset so this agrees with zone-local alignment; a fractional-offset zone
 * would still agree, because both sides bin from the same absolute reference.
 */
export const truncateToBucket = (date: Date, spec: GranularitySpec, timezone: string): Date => {
  if (spec.binSize > 1) {
    const binMs = spec.binSize * MS_PER_MINUTE;
    return new Date(Math.floor(date.getTime() / binMs) * binMs);
  }

  const dt = DateTime.fromJSDate(date, { zone: timezone });

  if (spec.unit === 'week') {
    // Luxon's ISO week already starts on Monday, which is what WEEK_START says.
    if (WEEK_START !== 'monday') {
      throw new Error(`Week start "${WEEK_START}" is not supported by the spine generator.`);
    }
    return dt.startOf('week').toJSDate();
  }

  return dt.startOf(spec.unit).toJSDate();
};

/**
 * Every bucket start in the window, in order, with no gaps.
 *
 * The last bucket is the one containing `to`, so a partially elapsed period
 * (today, this month) is present rather than omitted — a dashboard that hides
 * the current period looks like activity stopped.
 */
export const generateSpine = (window: TimeWindow, spec: GranularitySpec, timezone: string): Date[] => {
  const first = truncateToBucket(window.from, spec, timezone);
  const last = truncateToBucket(window.to, spec, timezone);

  const spine: Date[] = [];
  let cursor = DateTime.fromJSDate(first, { zone: timezone });
  const end = DateTime.fromJSDate(last, { zone: timezone });

  const step = spec.binSize > 1 ? { [LUXON_UNIT[spec.unit]]: spec.binSize } : { [LUXON_UNIT[spec.unit]]: 1 };

  // Bounded by MAX_BUCKETS upstream; the guard is here so a malformed spec can
  // never spin forever.
  while (cursor <= end && spine.length <= 10_000) {
    spine.push(cursor.toJSDate());
    cursor = cursor.plus(step);
  }

  return spine;
};

/**
 * Human-readable bucket label, formatted server-side.
 *
 * Formatting here rather than in the browser is deliberate: it is the last place
 * a date is turned into text, so an admin in another timezone cannot re-introduce
 * the off-by-one the engine exists to eliminate.
 */
export const formatBucketLabel = (date: Date, spec: GranularitySpec, timezone: string): string => {
  const dt = DateTime.fromJSDate(date, { zone: timezone });

  switch (spec.unit) {
    case 'minute':
    case 'hour':
      return dt.toFormat('HH:mm');
    case 'day':
      return dt.toFormat('dd LLL');
    case 'week':
      return `${dt.toFormat('dd LLL')}`;
    case 'month':
      return dt.toFormat('LLL yyyy');
    case 'quarter':
      return `Q${dt.quarter} ${dt.year}`;
    case 'year':
      return dt.toFormat('yyyy');
    default:
      return dt.toISO() ?? date.toISOString();
  }
};

export interface BucketRow {
  /** ISO 8601 with a real offset — `2026-03-01T00:00:00.000+01:00`, never `Z`. */
  bucket: string;
  bucketLabel: string;
  /** The raw instant, kept for sorting and for callers that want a Date. */
  bucketStart: Date;
}

export const describeBucket = (date: Date, spec: GranularitySpec, timezone: string): BucketRow => {
  const dt = DateTime.fromJSDate(date, { zone: timezone });

  return {
    // A bare `Z` handed to `new Date()` in a browser renders in the *browser's*
    // zone, which silently recreates the very bug this engine removes. The
    // offset makes the intended zone travel with the value.
    bucket: dt.toISO({ suppressMilliseconds: false }) ?? date.toISOString(),
    bucketLabel: formatBucketLabel(date, spec, timezone),
    bucketStart: date,
  };
};

/**
 * Merge sparse aggregation output onto a dense spine.
 *
 * `rows` are whatever the pipeline returned, keyed by bucket start. Missing
 * buckets become `defaultValue` (zero for counts and sums) rather than being
 * absent — an omitted bucket and a bucket with no activity look identical on a
 * chart, and only one of them is true.
 */
export const densify = <T>(
  rows: Array<{ bucketStart: Date; value: T }>,
  window: TimeWindow,
  spec: GranularitySpec,
  timezone: string,
  defaultValue: T
): Array<BucketRow & { value: T }> => {
  const byKey = new Map<number, T>();
  for (const row of rows) {
    byKey.set(new Date(row.bucketStart).getTime(), row.value);
  }

  const spine = generateSpine(window, spec, timezone);
  const seen = new Set<number>();

  const series = spine.map((date) => {
    const key = date.getTime();
    seen.add(key);

    return {
      ...describeBucket(date, spec, timezone),
      value: byKey.has(key) ? (byKey.get(key) as T) : defaultValue,
    };
  });

  // Union, not lookup: anything the spine failed to predict is surfaced rather
  // than dropped, so a spine defect can never present as missing data.
  const orphans = [...byKey.entries()]
    .filter(([key]) => !seen.has(key))
    .map(([key, value]) => ({ ...describeBucket(new Date(key), spec, timezone), value }));

  if (orphans.length === 0) return series;

  return [...series, ...orphans].sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());
};
