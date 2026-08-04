import { DateTime } from 'luxon';
import { DEFAULT_TIMEZONE } from '@/config/timezone';
import type { GranularitySpec } from './granularity';

export const PRESETS = [
  'today',
  'last_10_minutes',
  'last_24_hours',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'last_12_months',
  'last_2_years',
  'last_5_years',
  'year_to_date',
] as const;

export type Preset = (typeof PRESETS)[number];

export const isPreset = (value: unknown): value is Preset =>
  typeof value === 'string' && (PRESETS as readonly string[]).includes(value);

export type ComparisonMode = 'none' | 'previous' | 'year_over_year';

export const COMPARISON_MODES: ComparisonMode[] = ['none', 'previous', 'year_over_year'];

export interface TimeWindow {
  from: Date;
  to: Date;
}

/** Ten years. A wider range is almost always a typo'd year, and answering it means scanning everything. */
export const MAX_SPAN_MS = 3653 * 24 * 60 * 60 * 1000;

export class RangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RangeError';
  }
}

/**
 * Resolve a named preset in the given zone.
 *
 * Rolling presets ("last 30 days") end at the current instant rather than at a
 * day boundary, so the newest bucket reflects activity that already happened
 * today. Calendar presets ("today", "year to date") snap to zone-local
 * boundaries.
 */
export const resolvePreset = (
  preset: Preset,
  timezone: string = DEFAULT_TIMEZONE,
  now: Date = new Date()
): TimeWindow => {
  const end = DateTime.fromJSDate(now, { zone: timezone });

  switch (preset) {
    case 'today':
      return { from: end.startOf('day').toJSDate(), to: end.endOf('day').toJSDate() };

    case 'last_10_minutes':
      return { from: end.minus({ minutes: 10 }).toJSDate(), to: end.toJSDate() };

    case 'last_24_hours':
      return { from: end.minus({ hours: 24 }).toJSDate(), to: end.toJSDate() };

    case 'last_7_days':
      return { from: end.minus({ days: 7 }).toJSDate(), to: end.toJSDate() };

    case 'last_30_days':
      return { from: end.minus({ days: 30 }).toJSDate(), to: end.toJSDate() };

    case 'last_90_days':
      return { from: end.minus({ days: 90 }).toJSDate(), to: end.toJSDate() };

    case 'last_12_months':
      return { from: end.minus({ months: 12 }).toJSDate(), to: end.toJSDate() };

    case 'last_2_years':
      return { from: end.minus({ years: 2 }).toJSDate(), to: end.toJSDate() };

    case 'last_5_years':
      return { from: end.minus({ years: 5 }).toJSDate(), to: end.toJSDate() };

    case 'year_to_date':
      return { from: end.startOf('year').toJSDate(), to: end.toJSDate() };

    default: {
      const exhaustive: never = preset;
      throw new RangeError(`Unknown preset "${exhaustive}"`);
    }
  }
};

export interface ResolveWindowInput {
  preset?: string;
  from?: string;
  to?: string;
  timezone?: string;
  now?: Date;
}

/**
 * Resolve either a preset or an explicit from/to pair into a concrete window.
 * Exactly one of the two must be supplied — accepting both would leave it
 * ambiguous which one won.
 */
export const resolveWindow = ({
  preset,
  from,
  to,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
}: ResolveWindowInput): TimeWindow => {
  const hasExplicit = Boolean(from && to);

  if (preset && hasExplicit) {
    throw new RangeError('Provide either "preset" or "from"+"to", not both.');
  }

  if (preset) {
    if (!isPreset(preset)) {
      throw new RangeError(`Unknown preset "${preset}". Valid presets: ${PRESETS.join(', ')}.`);
    }
    return assertSpan(resolvePreset(preset, timezone, now));
  }

  if (!hasExplicit) {
    throw new RangeError('Provide either "preset" or both "from" and "to".');
  }

  // Interpreted in the store's zone, so `from=2026-03-01` means midnight in
  // Lagos rather than midnight UTC (an hour of the previous day locally).
  const start = DateTime.fromISO(from as string, { zone: timezone });
  const end = DateTime.fromISO(to as string, { zone: timezone });

  if (!start.isValid) throw new RangeError(`"from" is not a valid ISO date: ${from}`);
  if (!end.isValid) throw new RangeError(`"to" is not a valid ISO date: ${to}`);

  // A date with no time component means the whole day, not its first instant —
  // otherwise `to=2026-03-31` silently drops everything that happened that day.
  const endInclusive = /T/.test(to as string) ? end : end.endOf('day');

  if (endInclusive < start) {
    throw new RangeError('"to" must be on or after "from".');
  }

  return assertSpan({ from: start.toJSDate(), to: endInclusive.toJSDate() });
};

const assertSpan = (window: TimeWindow): TimeWindow => {
  if (window.to.getTime() - window.from.getTime() > MAX_SPAN_MS) {
    throw new RangeError('Range exceeds the 10-year maximum.');
  }
  return window;
};

export const spanMs = (window: TimeWindow): number => window.to.getTime() - window.from.getTime();

/**
 * The window a comparison is measured against.
 *
 * Shifted by whole calendar units of the resolved granularity, not by raw
 * elapsed milliseconds. The old approach — `previousFrom = from - (to - from)` —
 * compares March against "the 31 days before March", which straddles February
 * and January and quietly makes month-on-month growth wrong.
 *
 * Returns `null` for `none`, which is also what the caller uses to skip the
 * second query entirely.
 */
export const comparisonWindow = (
  window: TimeWindow,
  mode: ComparisonMode,
  spec: GranularitySpec,
  timezone: string = DEFAULT_TIMEZONE
): TimeWindow | null => {
  if (mode === 'none') return null;

  const from = DateTime.fromJSDate(window.from, { zone: timezone });
  const to = DateTime.fromJSDate(window.to, { zone: timezone });

  if (mode === 'year_over_year') {
    return { from: from.minus({ years: 1 }).toJSDate(), to: to.minus({ years: 1 }).toJSDate() };
  }

  // `previous`: step back by however many whole granularity units the window
  // spans, so a 3-month window is compared with the 3 months before it.
  const unitPlural = `${spec.unit}s` as 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'quarters' | 'years';

  const units = Math.max(1, Math.round(to.diff(from, unitPlural).get(unitPlural)));
  const shift = { [unitPlural]: units * spec.binSize } as Record<string, number>;

  return { from: from.minus(shift).toJSDate(), to: to.minus(shift).toJSDate() };
};

/**
 * Percentage change, with the one rule the old code got wrong: growth from a
 * zero baseline is `null`, not `0`. Rendering it as `0` reads as "flat" on a
 * dashboard when what actually happened is "went from nothing to something".
 */
export const changePct = (current: number, previous: number): number | null => {
  if (!previous) return null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

/** ISO 8601 with a real offset (`+01:00`), never `Z`. See buckets.ts for why. */
export const toZonedIso = (date: Date, timezone: string): string =>
  DateTime.fromJSDate(date, { zone: timezone }).toISO() ?? date.toISOString();
