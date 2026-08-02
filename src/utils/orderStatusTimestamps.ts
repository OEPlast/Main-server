/**
 * Order status → event-timestamp mapping.
 *
 * Analytics answers "how many orders were cancelled in March", which is a
 * question about WHEN THE CANCELLATION HAPPENED. `createdAt` answers a different
 * question (when the order was placed) and `updatedAt` answers none at all — it
 * holds only the latest mutation, so any metric built on it silently rewrites
 * itself every time a document is touched.
 *
 * So each terminal transition stamps its own field. Every site that changes an
 * order's status must go through `orderStatusUpdate()` rather than setting
 * `status` directly, so adding a new transition cannot quietly skip the stamp.
 */

export type OrderStatusValue = 'Pending' | 'Processing' | 'Cancelled' | 'Completed' | 'Failed';

/** Statuses that record an event time. Pending/Processing are not terminal events. */
const STATUS_TIMESTAMP_FIELD = {
  Cancelled: 'cancelledAt',
  Completed: 'completedAt',
  Failed: 'failedAt',
} as const satisfies Partial<Record<OrderStatusValue, string>>;

export type OrderEventTimestampField =
  | (typeof STATUS_TIMESTAMP_FIELD)[keyof typeof STATUS_TIMESTAMP_FIELD]
  | 'paidAt'
  | 'deliveredAt'
  | 'refundedAt';

export interface OrderStatusUpdatePayload {
  status: OrderStatusValue;
  cancelledAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
}

/**
 * Build the update payload for an order status change, including its event
 * timestamp when the status is one that records one.
 *
 * @example
 *   await Order.findByIdAndUpdate(orderId, orderStatusUpdate('Cancelled'));
 *   // → { status: 'Cancelled', cancelledAt: <now> }
 *
 * @param status - The status being transitioned to.
 * @param at - Event time. Defaults to now; pass explicitly when replaying or
 *             backfilling so the stamp reflects when the event actually occurred.
 */
export const orderStatusUpdate = (
  status: OrderStatusValue,
  at: Date = new Date()
): OrderStatusUpdatePayload => {
  const field = STATUS_TIMESTAMP_FIELD[status as keyof typeof STATUS_TIMESTAMP_FIELD];
  return field ? { status, [field]: at } : { status };
};

/**
 * The timestamp field a given status is measured on, or null if that status is
 * not a recorded event. Used by the analytics metric registry so a metric and
 * the write path can never disagree about which field means what.
 */
export const timestampFieldForStatus = (status: OrderStatusValue): string | null =>
  STATUS_TIMESTAMP_FIELD[status as keyof typeof STATUS_TIMESTAMP_FIELD] ?? null;
