import { nextSequence } from '@/models/Counter';

/**
 * Human-readable order references, e.g. `RW-2608-00417`.
 *
 * Format: <prefix>-<YYMM>-<sequence padded to 5>. The month segment keeps the sequence short
 * and makes the age of an order obvious to support without a lookup.
 */

const PREFIX = (process.env.ORDER_NUMBER_PREFIX || 'RW').toUpperCase();
const PAD = 5;

/** `2026-08-05` -> `2608` */
export function periodKey(date: Date = new Date()): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}${month}`;
}

export function counterKeyForPeriod(period: string): string {
  return `order:${period}`;
}

export function formatOrderNumber(period: string, sequence: number): string {
  return `${PREFIX}-${period}-${sequence.toString().padStart(PAD, '0')}`;
}

/** Allocates the next order number for the month `date` falls in. */
export async function generateOrderNumber(date: Date = new Date()): Promise<string> {
  const period = periodKey(date);
  const sequence = await nextSequence(counterKeyForPeriod(period));
  return formatOrderNumber(period, sequence);
}
