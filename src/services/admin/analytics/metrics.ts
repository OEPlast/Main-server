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

/**
 * Collections a metric can be computed from.
 *
 * The Model each of these resolves to lives in `sources.ts`, deliberately not
 * here: this module has to stay importable by tests and by the `/meta` endpoint
 * without pulling nine Mongoose models into the process.
 */
export type MetricSource =
  | 'orders'
  | 'transactions'
  | 'users'
  | 'reviews'
  | 'products'
  | 'shipments'
  | 'carts'
  | 'wishlist'
  | 'coupons'
  | 'coupon_redemptions';

/**
 * Whether a metric measures events over time or state at a moment.
 *
 * **flow** — things that happened inside a window: revenue, orders placed,
 * cancellations. These bucket on `timestampField` and are the engine's main
 * business.
 *
 * **stock** — how many of something exist *right now*: total users, products
 * below their reorder threshold, currently-active coupons. There is no event to
 * date, so a stock metric has no series and deliberately ignores the date range.
 * Mixing the two silently — which the old overview endpoints did — is why a
 * dashboard could show "active coupons" next to a date picker that had no effect
 * on it.
 */
export type MetricKind = 'flow' | 'stock';

export interface MetricDefinition {
  /** Stable key used by the analytics API. */
  key: string;
  label: string;
  group: MetricGroup;
  /** Defaults to 'flow'. Stock metrics answer "as of now" and have no series. */
  kind?: MetricKind;
  /** Collection the metric is computed from. */
  source: MetricSource;
  /**
   * The timestamp field this metric buckets on. This is the whole point of the
   * registry — get this wrong and the number answers a different question.
   *
   * Ignored for `kind: 'stock'`, which has no event to date.
   */
  timestampField: string;
  /** Extra match applied on top of the time window. */
  filter?: Record<string, unknown>;
  /**
   * How values combine within a bucket.
   *
   * `distinct` counts unique values of `valueField` — "how many different
   * customers ordered", not "how many orders". Like `avg`, it does NOT sum
   * across buckets: a customer who ordered in both January and February is one
   * distinct customer for the year, not two. The window total is therefore
   * always computed as its own pass, never reduced from the series.
   */
  aggregation: 'sum' | 'count' | 'avg' | 'distinct';
  /** Field summed/averaged/counted-distinct; omitted for plain counts. */
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

  pending_orders: {
    key: 'pending_orders',
    label: 'Pending orders',
    group: 'operational',
    source: 'orders',
    timestampField: 'createdAt',
    filter: { status: 'Pending' },
    aggregation: 'count',
    note: 'Replaces the legacy order-failed-* family, which despite its name matched status "Pending" — the admin has been charting pending orders under a "failed orders" label. Genuine failures are the `failures` metric. Creation-time is correct here: a pending order has not yet had a terminal event.',
  },

  deliveries: {
    key: 'deliveries',
    label: 'Deliveries',
    group: 'operational',
    source: 'orders',
    timestampField: 'deliveredAt',
    aggregation: 'count',
  },

  awaiting_delivery: {
    key: 'awaiting_delivery',
    label: 'Awaiting delivery',
    group: 'operational',
    kind: 'stock',
    source: 'orders',
    timestampField: 'createdAt',
    // Live orders with no delivery stamp. Cancelled orders are excluded — they
    // are not delivered, but nothing is waiting on them either.
    filter: { deliveredAt: null, status: { $in: ['Pending', 'Processing'] } },
    aggregation: 'count',
    note: 'Makes "not delivered" an explicit figure instead of an inference from a missing timestamp. Absence of deliveredAt already meant not-delivered, but nothing on any screen said so — and the unstamped reporter used to misread it as excluded data.',
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

  refund_amount: {
    key: 'refund_amount',
    label: 'Refunds paid',
    group: 'financial',
    source: 'transactions',
    timestampField: 'paidAt',
    filter: { transactionType: 'return_refund', status: 'completed' },
    aggregation: 'sum',
    valueField: 'amount',
    note: 'Money actually returned to customers. Completed refunds only — a pending or failed refund is not money that has left. This is authoritative for refund VALUE, where the `refunds` metric counts orders.',
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

  avg_rating: {
    key: 'avg_rating',
    label: 'Average rating',
    group: 'customer',
    source: 'reviews',
    timestampField: 'createdAt',
    filter: { isApproved: { $ne: false } },
    aggregation: 'avg',
    valueField: 'rating',
    note: 'An average cannot be reduced from its own series — the window total is computed as its own pass, not as the mean of the bucket means.',
  },

  // ---------------------------------------------------------------------------
  // Keys below exist so the legacy `-days`/`-months`/`-years` endpoint families
  // have a registry equivalent. "An equivalent key returns the same number" is
  // the gate for deleting those endpoints, so they are declared before the
  // deletion rather than after it.
  // ---------------------------------------------------------------------------

  shipments_delivered: {
    key: 'shipments_delivered',
    label: 'Shipments delivered',
    group: 'operational',
    source: 'shipments',
    // Shipment names this `deliveredOn`, not `deliveredAt` like Order does.
    timestampField: 'deliveredOn',
    aggregation: 'count',
    note: 'Replaces the shipments-delivered-* family. Measured on delivery, not on when the shipment record was created.',
  },

  shipments_in_warehouse: {
    key: 'shipments_in_warehouse',
    label: 'Shipments in warehouse',
    group: 'operational',
    source: 'shipments',
    timestampField: 'createdAt',
    aggregation: 'count',
    note: 'Genuinely a creation-time metric — a shipment enters the warehouse when its record is made.',
  },

  transactions_count: {
    key: 'transactions_count',
    label: 'Transactions',
    group: 'financial',
    source: 'transactions',
    timestampField: 'createdAt',
    aggregation: 'count',
    note: 'All transaction attempts, including failures — this is throughput, not income. Use transactions_amount for money.',
  },

  transactions_amount: {
    key: 'transactions_amount',
    label: 'Transaction value',
    group: 'financial',
    source: 'transactions',
    timestampField: 'paidAt',
    filter: { status: 'completed' },
    aggregation: 'sum',
    valueField: 'amount',
    note: 'Completed only, on paidAt. A pending or failed transaction is not money received.',
  },

  coupon_redemptions: {
    key: 'coupon_redemptions',
    label: 'Coupon redemptions',
    group: 'customer',
    source: 'coupon_redemptions',
    timestampField: 'createdAt',
    aggregation: 'count',
  },

  products_added: {
    key: 'products_added',
    label: 'Products added',
    group: 'operational',
    source: 'products',
    timestampField: 'createdAt',
    aggregation: 'count',
  },

  carts_created: {
    key: 'carts_created',
    label: 'Carts created',
    group: 'customer',
    source: 'carts',
    timestampField: 'createdAt',
    aggregation: 'count',
    note: 'The legacy current-carts-* family counted live carts at query time, which is a stock figure and cannot be bucketed by time. This counts cart creation instead — a different, answerable question.',
  },

  wishlist_adds: {
    key: 'wishlist_adds',
    label: 'Wishlist additions',
    group: 'customer',
    source: 'wishlist',
    timestampField: 'createdAt',
    aggregation: 'count',
  },

  discount_given: {
    key: 'discount_given',
    label: 'Discount given',
    group: 'financial',
    source: 'orders',
    timestampField: 'paidAt',
    filter: { isPaid: true },
    aggregation: 'sum',
    valueField: 'couponDiscount',
    note: 'COUPON discount only. The legacy figure also summed flashSaleApplied.discount, but that field is never written by any code path (see PROMOTIONS-ROI-PLAN.md), so including it added a guaranteed zero while implying flash-sale discount was covered. This metric is deliberately narrower and honest about it.',
  },

  // ---------------------------------------------------------------------------
  // STOCK metrics — state as of now, not events in a window.
  //
  // These carry no series and ignore the date range by design; the UI must say
  // so beside them. Definitions mirror the legacy overview endpoints exactly so
  // the numbers do not move when those endpoints are retired.
  // ---------------------------------------------------------------------------

  active_users: {
    key: 'active_users',
    label: 'Active customers',
    group: 'customer',
    source: 'orders',
    timestampField: 'createdAt',
    aggregation: 'distinct',
    valueField: 'user',
    note: 'Distinct customers who placed an order in the window. The legacy overview called Order.distinct("userId"), but the field is named `user` — so it matched nothing and activeUsers read 0 (and inactiveUsers read totalUsers) for as long as that endpoint existed.',
  },

  total_users: {
    key: 'total_users',
    label: 'Total users',
    group: 'customer',
    kind: 'stock',
    source: 'users',
    timestampField: 'createdAt',
    aggregation: 'count',
  },

  total_products: {
    key: 'total_products',
    label: 'Total products',
    group: 'operational',
    kind: 'stock',
    source: 'products',
    timestampField: 'createdAt',
    aggregation: 'count',
  },

  out_of_stock_products: {
    key: 'out_of_stock_products',
    label: 'Out of stock',
    group: 'operational',
    kind: 'stock',
    source: 'products',
    timestampField: 'createdAt',
    filter: { stock: { $lte: 0 } },
    aggregation: 'count',
  },

  low_stock_products: {
    key: 'low_stock_products',
    label: 'Low stock',
    group: 'operational',
    kind: 'stock',
    source: 'products',
    timestampField: 'createdAt',
    // In stock but at or below its own reorder threshold — the comparison is
    // between two fields, so it needs $expr rather than a literal.
    filter: {
      $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] },
    },
    aggregation: 'count',
    note: 'Stockouts are a revenue leak that no screen currently shows; this is the metric that makes them visible.',
  },

  active_coupons: {
    key: 'active_coupons',
    label: 'Active coupons',
    group: 'financial',
    kind: 'stock',
    source: 'coupons',
    timestampField: 'createdAt',
    // Flagged active AND inside its own validity window right now. `$$NOW` is
    // evaluated by the server, so this cannot drift with the client's clock.
    filter: {
      active: true,
      $expr: { $and: [{ $lte: ['$startDate', '$$NOW'] }, { $gte: ['$endDate', '$$NOW'] }] },
    },
    aggregation: 'count',
  },

  total_coupons: {
    key: 'total_coupons',
    label: 'Total coupons',
    group: 'financial',
    kind: 'stock',
    source: 'coupons',
    timestampField: 'createdAt',
    filter: { deleted: { $ne: true } },
    aggregation: 'count',
  },
};

/** Metrics visible to a given group — the hook role scoping will use. */
export const metricsInGroup = (group: MetricGroup): MetricDefinition[] =>
  Object.values(METRICS).filter((m) => m.group === group);

export const getMetric = (key: string): MetricDefinition | undefined => METRICS[key];
