import mongoose from 'mongoose';
import Order from '@/models/Order';
import Transaction, { ITransaction } from '@/models/Transaction';
import eventPublisher from '@/events/eventPublisher';
import { loadOrderEmailContext } from '@/services/email/orderEmailPayload';
import { cartUrl } from '@/services/brand';
import { cancelOrder, fulfilPaidOrder, markOrderPaid } from '@/services/orders/orderLifecycle';
import { logger } from '@/lib/logger';
import type { PaystackVerifyTransactionResponse } from '@/types/paystack';
import { classifyChargeStatus, toKobo, verifyTransaction } from './paystackClient';
import { flagTransactionForReview, refundTransaction } from './refunds';

/** What Paystack reports about a charge, in the shape every entry point hands over. */
export interface ChargeReport {
  status: string;
  amountKobo: number;
  currency?: string;
  gatewayId?: string | number;
  gatewayResponse?: string;
  paidAt?: string;
  fees?: number;
  channel?: string;
  raw?: unknown;
}

export function toChargeReport(data: PaystackVerifyTransactionResponse['data']): ChargeReport {
  return {
    status: data.status,
    amountKobo: data.amount,
    currency: data.currency,
    gatewayId: data.id,
    gatewayResponse: data.gateway_response,
    paidAt: data.paid_at,
    fees: data.fees,
    channel: data.channel,
    raw: data,
  };
}

export type ChargeAction =
  | 'paid'
  | 'failed'
  | 'waiting'
  | 'already_processed'
  | 'refunded_unfulfillable'
  | 'not_found';

export type ChargeSource = 'verify' | 'webhook' | 'reconciliation';

/**
 * A charge succeeded for an order that cannot take it: it was already cancelled (and its stock
 * released), already paid, or the amount did not match. The customer is refunded automatically
 * and staff are flagged, so a late bank transfer is never kept for goods that were released.
 */
async function refundUnfulfillablePayment(transaction: ITransaction, chargedNaira: number, reason: string) {
  const id = transaction._id as mongoose.Types.ObjectId;
  await flagTransactionForReview(id, `${reason}. Refunded automatically.`);

  const refund = await refundTransaction({
    transactionId: id,
    amount: chargedNaira,
    maxRefundable: chargedNaira,
    reason: `Automatic refund: ${reason}`,
    initiatedBy: 'system',
  });
  if (refund.code !== 200) {
    await flagTransactionForReview(id, `Automatic refund failed: ${refund.message}`);
  }
}

/**
 * Applies what Paystack says about a charge to the transaction and its order.
 *
 * The one place a payment outcome is acted on: payment verification, the webhook and the
 * reconciliation job all call it. They used to carry two drifting copies of this logic, each of
 * which read the transaction, checked its status, then saved it, so a webhook and the storefront's
 * verify call arriving together both ran fulfilment. Here every transition is claimed with a
 * single conditional update, and only the caller that wins it has side effects.
 */
export async function applyChargeOutcome(
  reference: string,
  charge: ChargeReport,
  source: ChargeSource
): Promise<{ action: ChargeAction; transaction: ITransaction | null }> {
  const transaction = await Transaction.findOne({ reference });
  if (!transaction || transaction.transactionType !== 'order_payment' || !transaction.orderId) {
    return { action: 'not_found', transaction: transaction ?? null };
  }

  const outcome = classifyChargeStatus(charge.status);
  if (outcome === 'in_progress') {
    return { action: 'waiting', transaction };
  }

  const gatewayFields: Record<string, unknown> = {
    'gatewayResponse.responseMessage': charge.status,
    ...(charge.gatewayId !== undefined ? { 'gatewayResponse.gatewayTransactionId': String(charge.gatewayId) } : {}),
    ...(charge.gatewayResponse ? { 'gatewayResponse.responseCode': charge.gatewayResponse } : {}),
    ...(charge.raw !== undefined ? { 'gatewayResponse.metadata': charge.raw } : {}),
    ...(charge.channel ? { channel: charge.channel } : {}),
    ...(typeof charge.fees === 'number'
      ? { fees: { gatewayFee: charge.fees / 100, processingFee: 0, totalFees: charge.fees / 100 } }
      : {}),
  };
  const orderId = transaction.orderId.toString();

  if (outcome === 'success') {
    const paidAt = charge.paidAt ? new Date(charge.paidAt) : new Date();
    // `failed` is claimable too: a payment can still succeed after its order timed out.
    const claimed = await Transaction.findOneAndUpdate(
      { _id: transaction._id, status: { $in: ['pending', 'failed'] } },
      { $set: { ...gatewayFields, status: 'completed', paidAt } },
      { new: true }
    );
    if (!claimed) {
      return { action: 'already_processed', transaction };
    }

    const expectedKobo = toKobo(claimed.amount);
    const expectedCurrency = (claimed.currency || 'NGN').toUpperCase();
    if (charge.amountKobo !== expectedKobo || (charge.currency ?? '').toUpperCase() !== expectedCurrency) {
      const reason = `Paystack charged ${charge.amountKobo} kobo ${charge.currency ?? '?'} but the order expected ${expectedKobo} kobo ${expectedCurrency}`;
      logger.error(`[${source}] ${reason} (reference ${reference})`);
      await cancelOrder({ orderId, by: 'system', refund: 'await_staff', notifyCustomer: false, reason: 'Payment amount mismatch' });
      await refundUnfulfillablePayment(claimed, charge.amountKobo / 100, reason);
      return { action: 'refunded_unfulfillable', transaction: claimed };
    }

    const paidOrder = await markOrderPaid(orderId, paidAt);
    if (!paidOrder) {
      const current = await Order.findById(orderId).select('status isPaid').lean();
      const reason = !current
        ? 'Payment received for an order that no longer exists'
        : current.isPaid
          ? 'Payment received for an order that was already paid'
          : `Payment received after the order was ${current.status.toLowerCase()}`;
      logger.warn(`[${source}] ${reason} (order ${orderId}, reference ${reference})`);
      await refundUnfulfillablePayment(claimed, charge.amountKobo / 100, reason);
      return { action: 'refunded_unfulfillable', transaction: claimed };
    }

    logger.info(`[${source}] Payment confirmed for order ${orderId}`);
    await fulfilPaidOrder(paidOrder, claimed);
    return { action: 'paid', transaction: claimed };
  }

  // outcome === 'failed'
  // A declined card is not the end of a payment: the customer can try another card in the same
  // payment window, and Paystack sends `charge.failed` for the first attempt while they do. Only the
  // storefront closing the window (verify) or the expired hold (reconciliation) ends the order.
  if (source === 'webhook') {
    logger.info(`[webhook] Payment attempt ${charge.status} for order ${orderId}; waiting for the customer to retry`);
    return { action: 'waiting', transaction };
  }

  const claimed = await Transaction.findOneAndUpdate(
    { _id: transaction._id, status: 'pending' },
    { $set: { ...gatewayFields, status: 'failed' } },
    { new: true }
  );
  if (!claimed) {
    return { action: 'already_processed', transaction };
  }

  const order = await Order.findById(orderId).select('status isPaid').lean();
  if (order && !order.isPaid && order.status === 'Pending') {
    await cancelOrder({ orderId, by: 'system', refund: 'await_staff', notifyCustomer: false, reason: 'Payment was not completed' });
  }

  // Closing the payment window is the customer's own choice; only a declined payment gets an email.
  if (charge.status !== 'abandoned') {
    const context = await loadOrderEmailContext(orderId);
    if (context) {
      await eventPublisher
        .publishPaymentFailed({
          userId: claimed.userId.toString(),
          reference: claimed.reference,
          email: context.email,
          firstName: context.firstName,
          lastName: context.lastName,
          orderId: context.orderId,
          orderNumber: context.orderNumber,
          purchaseDate: context.purchaseDate,
          amount: claimed.amount,
          paymentMethod: 'paystack',
          reason: charge.gatewayResponse,
          // The order is cancelled and its items released, so the retry starts again from the cart.
          retryPaymentLink: cartUrl(context.brand),
        })
        .catch((err) => logger.error('Failed to publish payment failed event:', err));
    }
  }
  await eventPublisher
    .publishWebsocketOrderUpdate({ orderId, status: 'failed' })
    .catch((err) => logger.error('Failed to publish payment failure update:', err));

  logger.info(`[${source}] Payment ${charge.status} for order ${orderId}; order cancelled`);
  return { action: 'failed', transaction: claimed };
}

export type ReconcileResult =
  | 'not_pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'waiting'
  | 'refunded_unfulfillable'
  | 'error';

/**
 * Settles one unpaid order whose payment window has passed.
 *
 * Replaces event-bus's in-memory timers, which were lost on every restart, recovered only orders
 * from the last 30 minutes, and never retried a failed call, leaving stock held indefinitely.
 *
 * @param options.maxWaitMs How long a payment Paystack still reports as in progress (a bank transfer
 *        awaiting confirmation) is waited for before the order is let go. A payment that succeeds
 *        after that is refunded automatically.
 */
export async function reconcileOrderPayment(
  orderId: string,
  options: { maxWaitMs: number }
): Promise<ReconcileResult> {
  try {
    const order = await Order.findById(orderId).select('status isPaid createdAt');
    if (!order || order.isPaid || order.status !== 'Pending') return 'not_pending';

    const ageMs = Date.now() - new Date(order.createdAt).getTime();
    const payment = await Transaction.findOne({ orderId, transactionType: 'order_payment' }).sort({ createdAt: -1 });

    if (!payment) {
      await cancelOrder({ orderId, by: 'system', refund: 'await_staff', notifyCustomer: false, reason: 'Payment was never started' });
      return 'expired';
    }

    // A crash between claiming the payment and marking the order paid leaves this combination;
    // finish the job instead of cancelling a paid order.
    if (payment.status === 'completed') {
      const paidOrder = await markOrderPaid(orderId, payment.paidAt ?? new Date());
      if (paidOrder) await fulfilPaidOrder(paidOrder, payment);
      return 'paid';
    }
    // The same crash on the failure side: the payment was marked failed but the order never let go.
    if (payment.status === 'failed') {
      await cancelOrder({ orderId, by: 'system', refund: 'await_staff', notifyCustomer: false, reason: 'Payment was not completed' });
      return 'failed';
    }

    const verification = await verifyTransaction(payment.reference);
    if (!verification.status) {
      // Paystack has no record of the charge: checkout started but the payment window never opened.
      const result = await applyChargeOutcome(
        payment.reference,
        { status: 'abandoned', amountKobo: 0, raw: { expiredBy: 'reconciliation', paystack: verification.message } },
        'reconciliation'
      );
      return result.action === 'failed' ? 'expired' : 'waiting';
    }

    const report = toChargeReport(verification.data);
    const result = await applyChargeOutcome(payment.reference, report, 'reconciliation');

    if (result.action === 'waiting' && ageMs >= options.maxWaitMs) {
      await applyChargeOutcome(
        payment.reference,
        { ...report, status: 'abandoned', raw: { expiredBy: 'reconciliation', paystackStatus: report.status } },
        'reconciliation'
      );
      return 'expired';
    }

    switch (result.action) {
      case 'paid':
        return 'paid';
      case 'failed':
        return 'failed';
      case 'refunded_unfulfillable':
        return 'refunded_unfulfillable';
      default:
        return 'waiting';
    }
  } catch (error) {
    logger.error(`Reconciliation failed for order ${orderId}:`, error);
    return 'error';
  }
}
