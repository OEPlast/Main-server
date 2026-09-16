import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import Transaction, { ITransaction, TransactionStatus } from '@/models/Transaction';
import Order from '@/models/Order';
import { logger } from '@/lib/logger';
import type { CustomResponseType } from '@/types';
import type { PaystackRefundWebhookData } from '@/types/paystack';
import { createRefund, toKobo } from './paystackClient';

const round2 = (value: number): number => Math.round(value * 100) / 100;

type RefundEntry = ITransaction['refunds'][number];

/** Refunds that still count against what can be refunded: everything Paystack has not rejected. */
const committedRefundTotal = (refunds: RefundEntry[]): number =>
  round2(refunds.filter((r) => r.status !== 'failed').reduce((sum, r) => sum + r.amount, 0));

/** The payment's status once `refunds` is taken into account. Only settled refunds count. */
function statusAfterRefunds(transaction: Pick<ITransaction, 'amount' | 'refunds'>): TransactionStatus {
  const settled = round2(
    transaction.refunds.filter((r) => r.status === 'completed').reduce((sum, r) => sum + r.amount, 0)
  );
  if (settled <= 0) return 'completed';
  return settled >= transaction.amount ? 'refunded' : 'partially_refunded';
}

/**
 * Marks a transaction for staff attention. Reasons accumulate while a flag is open, so a second
 * problem on the same payment is not overwritten by the first.
 */
export async function flagTransactionForReview(
  transactionId: string | mongoose.Types.ObjectId,
  reason: string
): Promise<void> {
  const current = await Transaction.findById(transactionId).select('review').lean();
  const open = current?.review?.required && !current.review.resolvedAt;
  const combined = open && current?.review?.reason ? `${current.review.reason} | ${reason}` : reason;

  await Transaction.updateOne(
    { _id: transactionId },
    { $set: { review: { required: true, reason: combined, flaggedAt: new Date() } } }
  );
  logger.error(`Transaction ${transactionId.toString()} flagged for staff review: ${reason}`);
}

/** Clears an open review flag once staff have dealt with it. */
export async function resolveTransactionReview(transactionId: string | mongoose.Types.ObjectId): Promise<void> {
  await Transaction.updateOne(
    { _id: transactionId, 'review.required': true },
    { $set: { 'review.required': false, 'review.resolvedAt': new Date() } }
  );
}

/**
 * Refunds a Paystack order payment, for real.
 *
 * Every refund used to be written as `completed` without Paystack ever being called, and the
 * customer was emailed that their money was on its way. Now the amount is reserved on the
 * transaction first, Paystack is asked to refund it, and the entry stays `pending` until Paystack's
 * `refund.processed` webhook confirms it (see applyRefundWebhook).
 *
 * @param input.amount Naira to refund; defaults to everything still refundable.
 * @param input.maxRefundable Cap to refund against instead of the transaction amount, for a charge
 *        that was larger than the order it paid for.
 * @param input.initiatedBy Admin user id, or 'system'.
 */
export async function refundTransaction(input: {
  transactionId: string | mongoose.Types.ObjectId;
  amount?: number;
  reason: string;
  initiatedBy: string;
  maxRefundable?: number;
}): Promise<CustomResponseType<ITransaction>> {
  const transaction = await Transaction.findById(input.transactionId);
  if (!transaction) {
    return { message: 'Transaction not found', data: null, code: 404 };
  }
  if (transaction.transactionType !== 'order_payment' || transaction.paymentGateway !== 'paystack') {
    return { message: 'Only Paystack order payments can be refunded through Paystack', data: null, code: 400 };
  }
  if (!['completed', 'partially_refunded'].includes(transaction.status)) {
    return { message: `A ${transaction.status} payment cannot be refunded`, data: null, code: 400 };
  }

  const cap = round2(input.maxRefundable ?? transaction.amount);
  const available = round2(cap - committedRefundTotal(transaction.refunds));
  const amount = round2(input.amount ?? available);
  if (available <= 0) {
    return { message: 'This payment has already been refunded in full', data: null, code: 400 };
  }
  if (amount <= 0 || amount > available) {
    return { message: `Refund amount must be between 0 and ${available}`, data: null, code: 400 };
  }

  // Reserve the amount before asking Paystack, then re-check: two refunds started at the same time
  // both land here, both see the other's reservation, and both back out instead of over-refunding.
  const refundId = `REF_${randomUUID()}`;
  const reserved = await Transaction.findByIdAndUpdate(
    transaction._id,
    {
      $push: {
        refunds: {
          refundId,
          amount,
          reason: input.reason,
          status: 'pending',
          refundDate: new Date(),
          initiatedBy: input.initiatedBy,
        },
      },
    },
    { new: true }
  );
  const setRefundStatus = (status: RefundEntry['status'], gatewayRefundId?: string) =>
    Transaction.findOneAndUpdate(
      { _id: transaction._id, 'refunds.refundId': refundId },
      {
        $set: {
          'refunds.$.status': status,
          ...(gatewayRefundId ? { 'refunds.$.gatewayRefundId': gatewayRefundId } : {}),
        },
      },
      { new: true }
    );

  if (!reserved || committedRefundTotal(reserved.refunds) > cap + 0.001) {
    await setRefundStatus('failed');
    return { message: 'Another refund for this payment is already in progress', data: null, code: 409 };
  }

  let response: Awaited<ReturnType<typeof createRefund>>;
  try {
    response = await createRefund({ reference: transaction.reference, amountKobo: toKobo(amount), note: input.reason });
  } catch (error) {
    await setRefundStatus('failed');
    logger.error(`Paystack refund request failed for ${transaction.reference}:`, error);
    return { message: 'Could not reach Paystack to request the refund. No money was moved.', data: null, code: 502 };
  }

  if (!response.status) {
    await setRefundStatus('failed');
    return { message: response.message || 'Paystack rejected the refund. No money was moved.', data: null, code: 400 };
  }

  const settled = response.data.status === 'processed';
  const updated = await setRefundStatus(settled ? 'completed' : 'pending', String(response.data.id));
  if (updated) {
    await Transaction.updateOne({ _id: updated._id }, { $set: { status: statusAfterRefunds(updated) } });
    updated.status = statusAfterRefunds(updated);
  }

  // First-refund marker for analytics; later partial refunds do not move it.
  if (transaction.orderId) {
    await Order.updateOne({ _id: transaction.orderId, refundedAt: { $exists: false } }, { $set: { refundedAt: new Date() } });
  }

  logger.info(
    `Refund ${refundId} of ₦${amount} requested for ${transaction.reference} (Paystack status: ${response.data.status})`
  );
  return { message: 'Refund requested from Paystack', data: updated, code: 200 };
}

/**
 * Settles a refund from Paystack's `refund.*` webhooks.
 *
 * Paystack's refund events carry the payment reference and the amount, not always a refund id, so
 * the refund is matched by its gateway id when present and otherwise by the oldest pending refund of
 * that amount. Idempotent: a repeated event finds the refund already in its final state.
 */
export async function applyRefundWebhook(event: string, data: PaystackRefundWebhookData): Promise<void> {
  const nextStatus: RefundEntry['status'] | null =
    event === 'refund.processed' ? 'completed' : event === 'refund.failed' ? 'failed' : null;
  if (!nextStatus) return; // refund.pending / refund.processing: nothing has settled yet

  const transaction = await Transaction.findOne({ reference: data.transaction_reference });
  if (!transaction) {
    logger.warn(`Paystack ${event}: no transaction with reference ${data.transaction_reference}`);
    return;
  }

  const amount = round2(Number(data.amount) / 100);
  const byGatewayId =
    data.id !== undefined && data.id !== null
      ? transaction.refunds.find((r) => r.gatewayRefundId === String(data.id))
      : undefined;
  const refund =
    byGatewayId ?? transaction.refunds.find((r) => r.status === 'pending' && Math.abs(r.amount - amount) < 0.005);
  if (!refund) {
    logger.warn(`Paystack ${event}: no pending refund of ₦${amount} on ${data.transaction_reference}`);
    return;
  }

  const updated = await Transaction.findOneAndUpdate(
    { _id: transaction._id, refunds: { $elemMatch: { refundId: refund.refundId, status: { $ne: nextStatus } } } },
    { $set: { 'refunds.$.status': nextStatus } },
    { new: true }
  );
  if (!updated) return; // already settled

  await Transaction.updateOne({ _id: updated._id }, { $set: { status: statusAfterRefunds(updated) } });

  // Keep a return's refund record in step with the refund it represents.
  if (refund.gatewayRefundId) {
    await Transaction.updateMany(
      { transactionType: 'return_refund', 'gatewayResponse.gatewayTransactionId': refund.gatewayRefundId },
      { $set: { status: nextStatus === 'completed' ? 'completed' : 'failed' } }
    );
  }

  if (nextStatus === 'failed') {
    await flagTransactionForReview(
      transaction._id as mongoose.Types.ObjectId,
      `Paystack could not complete the ₦${amount} refund (${refund.reason}). The customer has not been paid back.`
    );
  }
  logger.info(`Refund ${refund.refundId} on ${data.transaction_reference} is now ${nextStatus}`);
}
