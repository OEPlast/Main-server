import cron from 'node-cron';
import Order from '@/models/Order';
import { reconcileOrderPayment, ReconcileResult } from '@/services/payments/paymentOutcome';
import { logger } from '@/lib/logger';

/** How long an unpaid order holds its stock before it is checked with Paystack (default 30 minutes). */
export const paymentHoldMs = (): number => Math.max(60_000, Number(process.env.CART_RESTORATION_TIMEFRAME || 1_800_000));

/**
 * How long a payment Paystack still reports as in progress is waited for before the order is let
 * go (default 4× the hold, 2 hours). Bank transfers can confirm well after the payment window
 * closes; one that lands after this is refunded automatically and flagged for staff.
 */
export const paymentMaxWaitMs = (): number =>
  Math.max(paymentHoldMs(), Number(process.env.PAYMENT_MAX_WAIT_MS || paymentHoldMs() * 4));

const BATCH_SIZE = 100;
let running = false;

/**
 * Settles every unpaid order whose hold has expired.
 *
 * Replaces event-bus's in-memory `setTimeout` per order, which was lost whenever event-bus restarted,
 * only recovered orders from the last 30 minutes, and never retried a failed call, so an order could
 * hold its stock forever. This reads the orders from the database every run instead, so nothing
 * depends on a process staying up. Safe to overlap across instances: every transition inside is an
 * atomic claim.
 */
async function runPaymentReconciliation(): Promise<void> {
  if (running) return;
  running = true;
  const tally: Partial<Record<ReconcileResult, number>> = {};

  try {
    const cutoff = new Date(Date.now() - paymentHoldMs());
    const orders = await Order.find({ status: 'Pending', isPaid: false, createdAt: { $lt: cutoff } })
      .sort({ createdAt: 1 })
      .limit(BATCH_SIZE)
      .select('_id')
      .lean();

    for (const order of orders) {
      const result = await reconcileOrderPayment(order._id.toString(), { maxWaitMs: paymentMaxWaitMs() });
      tally[result] = (tally[result] ?? 0) + 1;
    }

    if (orders.length > 0) {
      logger.info(`[payment-reconciliation] ${orders.length} expired unpaid orders: ${JSON.stringify(tally)}`);
    }
  } catch (error) {
    logger.error('[payment-reconciliation] run failed:', error);
  } finally {
    running = false;
  }
}

export function startPaymentReconciliation(): void {
  cron.schedule('*/5 * * * *', () => {
    void runPaymentReconciliation();
  });
  logger.info(
    `[payment-reconciliation] Started: hold ${Math.round(paymentHoldMs() / 60_000)} min, max wait ${Math.round(
      paymentMaxWaitMs() / 60_000
    )} min`
  );
}
