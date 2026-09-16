import type { PaystackCreateRefundResponse, PaystackVerifyTransactionResponse } from '@/types/paystack';

const PAYSTACK_API = 'https://api.paystack.co';

/** A hung Paystack call must not hold a checkout, a webhook or the reconciliation job forever. */
const REQUEST_TIMEOUT_MS = 15_000;

async function paystackRequest<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return (await response.json()) as T;
}

/** Naira to kobo, the unit Paystack amounts are expressed in. */
export const toKobo = (naira: number): number => Math.round(naira * 100);

/** Asks Paystack for the current state of a charge. Paystack is the source of truth. */
export const verifyTransaction = (reference: string) =>
  paystackRequest<PaystackVerifyTransactionResponse>(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
  });

/**
 * Requests a refund. Paystack answers `pending`/`processing` and settles it later through a
 * `refund.processed` or `refund.failed` webhook.
 */
export const createRefund = (input: { reference: string; amountKobo: number; note: string }) =>
  paystackRequest<PaystackCreateRefundResponse>('/refund', {
    method: 'POST',
    body: {
      transaction: input.reference,
      amount: input.amountKobo,
      customer_note: input.note,
      merchant_note: input.note,
    },
  });

export type ChargeOutcome = 'success' | 'failed' | 'in_progress';

/**
 * What a Paystack charge status means for the order.
 *
 * Only `success` pays for an order, and only `failed`, `reversed` and `abandoned` end one.
 * `ongoing`, `pending`, `processing` and `queued` mean money may still be on its way: Paystack
 * reports `ongoing` while it waits for a bank transfer or an OTP. Treating those as failures
 * cancelled orders whose customers were in the middle of paying.
 */
export function classifyChargeStatus(status: string | undefined): ChargeOutcome {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
    case 'reversed':
    case 'abandoned':
      return 'failed';
    default:
      return 'in_progress';
  }
}
