/**
 * Analytics metric registry.
 *
 * Every metric declares the timestamp field it is measured on, in one reviewable
 * place, instead of that choice being buried across ~99 aggregations. Two rules
 * hold everywhere:
 *
 *   1. Bucket by WHEN THE EVENT HAPPENED, not when the document was created.
 *      "Cancellations in March" means orders cancelled in March — not March
 *      orders that are cancelled now.
 *   2. `updatedAt` is NEVER a valid source. It holds only the most recent
 *      mutation, so any metric built on it silently rewrites its own history
 *      whenever a document is touched.
 *
 * The status→timestamp mapping here is the same one the write path uses
 * (`utils/orderStatusTimestamps`), so a metric and the code that stamps it
 * cannot drift apart.
 */

/** Which broad area a metric belongs to. This is the seam role-scoped analytics uses later. */
export type MetricGroup = 'financial' | 'operational' | 'customer';

export interface MetricDefinition {
  /** Stable key used by the analytics API. */
  key: string;
  label: string;
  group: MetricGroup;
  /** Collection the metric is computed from. */
  source: 'orders' | 'transactions' | 'users' | 'reviews' | 'products';
  /**
   * The timestamp field this metric buckets on. This is the whole point of the
   * registry — get this wrong and the number answers a different question.
   */
  timestampField: string;
  /** Extra match applied on top of the time window. */
  filter?: Record<string, unknown>;
  /** How values combine within a bucket. */
  aggregation: 'sum' | 'count' | 'avg';
  /** Field summed/averaged; omitted for counts. */
  valueField?: string;
  /** Why this timestamp, where the choice is not obvious. */
  note?: string;
}

export const METRICS: Record<string, MetricDefinition> = {
  revenue: {
    key: 'revenue',
    label: 'Revenue',
    group: 'financial',
    source: 'orders',
    timestampField: 'paidAt',
    filter: { isPaid: true },
    aggregation: 'sum',
    valueField: 'total',
    note: 'Revenue means PAID. Bucketing on createdAt (the previous behaviour) counted unpaid pending orders as revenue and dated income to when the order was placed rather than when money arrived.',
  },

  orders_placed: {
    key: 'orders_placed',
    label: 'Orders placed',
    group: 'operational',
    source: 'orders',
    timestampField: 'createdAt',
    aggregation: 'count',
    note: 'Genuinely a creation-time metric — this one is correct on createdAt.',
  },

  orders_paid: {
    key: 'orders_paid',
    label: 'Orders paid',
    group: 'financial',
    source: 'orders',
    timestampField: 'paidAt',
    filter: { isPaid: true },
    aggregation: 'count',
  },

  aov: {
    key: 'aov',
    label: 'Average order value',
    group: 'financial',
    source: 'orders',
    timestampField: 'paidAt',
    filter: { isPaid: true },
    aggregation: 'avg',
    valueField: 'total',
    note: 'Paid orders only, so AOV is not diluted by abandoned pending orders.',
  },

  cancellations: {
    key: 'cancellations',
    label: 'Cancellations',
    group: 'operational',
    source: 'orders',
    timestampField: 'cancelledAt',
    filter: { status: 'Cancelled' },
    aggregation: 'count',
    note: 'Requires the cancelledAt backfill; orders cancelled before it exists have a null stamp and are reported as unknown rather than silently dated to createdAt.',
  },

  completions: {
    key: 'completions',
    label: 'Completed orders',
    group: 'operational',
    source: 'orders',
    timestampField: 'completedAt',
    filter: { status: 'Completed' },
    aggregation: 'count',
  },

  failures: {
    key: 'failures',
    label: 'Failed orders',
    group: 'operational',
    source: 'orders',
    timestampField: 'failedAt',
    filter: { status: 'Failed' },
    aggregation: 'count',
  },

  deliveries: {
    key: 'deliveries',
    label: 'Deliveries',
    group: 'operational',
    source: 'orders',
    timestampField: 'deliveredAt',
    aggregation: 'count',
  },

  refunds: {
    key: 'refunds',
    label: 'Refunded orders',
    group: 'financial',
    source: 'orders',
    timestampField: 'refundedAt',
    aggregation: 'count',
    note: 'First-refund marker on the order. Transaction (transactionType: return_refund) remains authoritative for refund AMOUNTS and partial refunds.',
  },

  new_customers: {
    key: 'new_customers',
    label: 'New customers',
    group: 'customer',
    source: 'users',
    timestampField: 'createdAt',
    aggregation: 'count',
  },

  reviews_written: {
    key: 'reviews_written',
    label: 'Reviews written',
    group: 'customer',
    source: 'reviews',
    timestampField: 'createdAt',
    filter: { isApproved: { $ne: false } },
    aggregation: 'count',
    note: 'Approved-only, matching what the storefront actually shows.',
  },
};

/** Metrics visible to a given group — the hook role scoping will use. */
export const metricsInGroup = (group: MetricGroup): MetricDefinition[] =>
  Object.values(METRICS).filter((m) => m.group === group);

export const getMetric = (key: string): MetricDefinition | undefined => METRICS[key];
