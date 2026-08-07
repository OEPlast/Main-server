import type { EmailProduct, ReturnStatus } from '@rawura/emails';
import EmailProcessor from '@/services/processor/EmailProcessor';
import { loadOrderEmailContext } from './orderEmailPayload';
import { logger } from '@/lib/logger';

/**
 * Emails for the returns lifecycle.
 *
 * The returns feature shipped with nine statuses and no customer communication whatsoever:
 * a shopper could open a return, have it approved, post the items back and receive a refund
 * without a single email at any point. These are the notifications for that flow.
 */

/** Business days a refund typically takes to land, by method. */
const REFUND_ETA_DAYS: Record<string, number> = {
  original_payment: 7,
  bank_transfer: 3,
  store_credit: 0,
  wallet: 1,
};

export function refundEtaDays(method: string): number | undefined {
  const days = REFUND_ETA_DAYS[method];
  return days && days > 0 ? days : undefined;
}

/** `wrong_item` -> `Wrong item`. The stored reasons are enum slugs, not prose. */
export function humaniseReason(reason: string | undefined | null): string | undefined {
  if (!reason) return undefined;
  const text = reason.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface ReturnLine {
  product: unknown;
  qty: number;
  reason?: string;
  refundAmount?: number | null;
}

/**
 * Maps return line items onto the products from the original order, so the email shows the
 * same names, images and categories the customer saw when they bought them.
 */
function toEmailProducts(items: ReturnLine[], orderProducts: EmailProduct[], orderLineIds: string[]): EmailProduct[] {
  return items.map((item) => {
    const productId = String(item.product);
    const index = orderLineIds.indexOf(productId);
    const source = index >= 0 ? orderProducts[index] : undefined;

    return {
      name: source?.name ?? 'Item',
      imagePath: source?.imagePath ?? '',
      slug: source?.slug,
      category: source?.category,
      quantity: item.qty,
      price: source?.price,
      subtotal: typeof item.refundAmount === 'number' ? item.refundAmount : undefined,
    };
  });
}

export interface ReturnEmailInput {
  orderId: string;
  returnId: string;
  returnNumber: string;
  returnType: 'refund' | 'exchange';
  items: ReturnLine[];
  /** Product ids of the original order lines, positionally aligned with the order products. */
  orderLineIds: string[];
}

/** Confirms a return request was received and is queued for review. */
export async function sendReturnRequested(
  input: ReturnEmailInput & { requestedAt: Date; reason?: string; estimatedRefund?: number }
): Promise<void> {
  const context = await loadOrderEmailContext(input.orderId);
  if (!context) return;

  await EmailProcessor.send('return-requested', {
    email: context.email,
    firstName: context.firstName,
    lastName: context.lastName,
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    purchaseDate: context.purchaseDate,
    returnId: input.returnId,
    returnNumber: input.returnNumber,
    returnType: input.returnType,
    reason: humaniseReason(input.reason),
    requestedAt: input.requestedAt,
    items: toEmailProducts(input.items, context.products, input.orderLineIds),
    estimatedRefund: input.estimatedRefund,
    viewReturnLink: context.links.returns,
  });
}

/** Any post-request transition: approved, rejected, received, inspected, completed, cancelled. */
export async function sendReturnStatus(
  input: ReturnEmailInput & {
    status: ReturnStatus;
    updatedAt: Date;
    adminNotes?: string;
    refundAmount?: number;
  }
): Promise<void> {
  const context = await loadOrderEmailContext(input.orderId);
  if (!context) return;

  // Return shipping instructions only make sense once a return is actually approved.
  const approved = input.status === 'approved';

  await EmailProcessor.send('return-status', {
    email: context.email,
    firstName: context.firstName,
    lastName: context.lastName,
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    purchaseDate: context.purchaseDate,
    returnId: input.returnId,
    returnNumber: input.returnNumber,
    returnType: input.returnType,
    status: input.status,
    updatedAt: input.updatedAt,
    items: toEmailProducts(input.items, context.products, input.orderLineIds),
    adminNotes: input.adminNotes,
    refundAmount: input.refundAmount,
    returnAddress: approved ? (process.env.RETURNS_ADDRESS || context.brand.addressLine || undefined) : undefined,
    returnInstructions: approved
      ? process.env.RETURNS_INSTRUCTIONS ||
        'Pack the items securely with all original accessories and packaging. Keep your proof of postage until the refund clears.'
      : undefined,
    viewReturnLink: context.links.returns,
  });
}

/** Money has been sent back. */
export async function sendRefundIssued(
  input: ReturnEmailInput & {
    refundAmount: number;
    refundMethod: string;
    refundReference?: string;
    refundedAt: Date;
  }
): Promise<void> {
  const context = await loadOrderEmailContext(input.orderId);
  if (!context) return;

  await EmailProcessor.send('order-refunded', {
    email: context.email,
    firstName: context.firstName,
    lastName: context.lastName,
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    purchaseDate: context.purchaseDate,
    returnId: input.returnId,
    returnNumber: input.returnNumber,
    returnedProducts: toEmailProducts(input.items, context.products, input.orderLineIds),
    refundAmount: input.refundAmount,
    refundMethod: humaniseReason(input.refundMethod) ?? input.refundMethod,
    refundReference: input.refundReference,
    refundedAt: input.refundedAt,
    refundEtaDays: refundEtaDays(input.refundMethod),
    shipping: context.shipping,
    checkRefundLink: context.links.returns,
  });
}

/**
 * Wraps a return email send so a mail failure can never fail the operation that triggered it.
 * A rejected return must still be rejected even if SMTP is down.
 */
export function fireAndLog(promise: Promise<void>, description: string): void {
  promise.catch((error) => logger.error(`[email] ${description} failed`, error));
}
