import Transaction, { ITransaction } from '../models/Transaction';
import Order from '../models/Order';
import { CustomResponseType } from '@/types';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { PaystackInitializeData, PaystackResponse, PaystackRefundWebhookData, PaystackWebhookData } from '@/types/paystack';
import { verifyTransaction } from './payments/paystackClient';
import { applyChargeOutcome, toChargeReport } from './payments/paymentOutcome';
import { applyRefundWebhook, refundTransaction } from './payments/refunds';

const initializePayment = async (paymentData: {
  orderId: string;
  userId: string;
  email: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}): Promise<
  CustomResponseType<{ access_code: string; paymentUrl: string; reference: string; transaction: ITransaction }>
> => {
  try {
    // Use mongo orderId as reference (ensure stable per order)
    const reference = paymentData.orderId;

    // Get order details and authoritative amount
    const order = await Order.findById(paymentData.orderId);
    if (!order) {
      return { message: 'Order not found', data: null, code: 404 };
    }

    const currency = paymentData.currency || 'NGN';
    const amount = typeof order.total === 'number' ? order.total : paymentData.amount;
    const amountInKobo = Math.round(currency === 'NGN' ? amount * 100 : amount);

    // Initialize payment with Paystack first to get transaction ID
    const paystackData: PaystackInitializeData = {
      email: paymentData.email,
      amount: amountInKobo,
      currency,
      reference,
      metadata: { orderId: paymentData.orderId, userId: paymentData.userId, ...paymentData.metadata },
      callback_url: process.env.FRONTEND_CALLBACK_URL,
    };

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackData),
      signal: AbortSignal.timeout(15_000),
    });

    const result = (await paystackResponse.json()) as PaystackResponse;

    if (!result.status) {
      return {
        message: result.message || 'Failed to initialize payment',
        data: null,
        code: 400,
      };
    }

    // Create transaction record
    const transaction = new Transaction({
      orderId: paymentData.orderId,
      userId: paymentData.userId,
      reference,
      amount,
      currency,
      paymentMethod: 'paystack',
      paymentGateway: 'paystack',
      status: 'pending',
      accessCode: result.data.access_code,
      gatewayResponse: {
        transactionReference: result.data.reference,
        gatewayTransactionId: result.data.access_code,
        responseCode: '200',
        responseMessage: 'Payment initialized successfully',
        metadata: result.data,
      },
      customerInfo: {
        email: paymentData.email,
        name: `${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}`.trim() || 'Customer',
        phone: order.shippingAddress?.phoneNumber,
      },
      fees: { gatewayFee: 0, processingFee: 0, totalFees: 0 },
      metadata: paymentData.metadata,
    });

    await transaction.save();

    // Update order with transaction ID
    await Order.findByIdAndUpdate(paymentData.orderId, { transactionId: transaction._id });

    return {
      message: 'Payment initialized successfully',
      data: {
        paymentUrl: result.data.authorization_url,
        reference: result.data.reference,
        transaction,
        access_code: result.data.access_code,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error initializing payment:', error);
    return {
      message: 'Failed to initialize payment',
      data: null,
      code: 500,
    };
  }
};

/**
 * Verifies a payment with Paystack and applies the result.
 *
 * Called by the storefront when the payment window closes (success, cancel or error) and before a
 * new checkout. Paystack's answer is the only input: the order is paid on `success`, cancelled on
 * `failed`/`abandoned`, and left alone while Paystack still reports the payment in progress.
 */
const verifyPayment = async (reference: string): Promise<CustomResponseType<ITransaction>> => {
  try {
    const result = await verifyTransaction(reference);
    if (!result.status) {
      return { message: result.message || 'Payment verification failed', data: null, code: 400 };
    }

    const { action, transaction } = await applyChargeOutcome(reference, toChargeReport(result.data), 'verify');
    if (action === 'not_found' || !transaction) {
      return { message: 'Transaction record not found', data: null, code: 404 };
    }

    const current = await Transaction.findById(transaction._id);
    return { message: 'Payment reference verified successfully', data: current ?? transaction, code: 200 };
  } catch (error) {
    logger.error('Error verifying payment:', error);
    return { message: 'Failed to verify payment', data: null, code: 500 };
  }
};

const CHARGE_EVENTS = new Set(['charge.success', 'charge.failed']);
const REFUND_EVENTS = new Set(['refund.pending', 'refund.processing', 'refund.processed', 'refund.failed']);

/** Constant-time comparison of two hex digests. */
const signaturesMatch = (expected: string, received: string): boolean => {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received ?? '', 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Handles a Paystack webhook (raw body, for the signature).
 *
 * Charge events are re-verified against Paystack's API before anything is applied, so the order
 * is settled from the same authoritative data as every other path. Answers 500 only when that
 * lookup fails, which makes Paystack retry; anything else is acknowledged so it is not redelivered.
 */
const handleWebhook = async (rawBody: Buffer, signature: string): Promise<CustomResponseType<string>> => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('Paystack webhook: missing webhook secret');
      return { message: 'Missing webhook secret', data: null, code: 500 };
    }

    const hash = crypto.createHmac('sha512', secret).update(new Uint8Array(rawBody)).digest('hex');
    if (!signaturesMatch(hash, signature)) {
      logger.warn('Paystack webhook: signature mismatch');
      return { message: 'Invalid signature', data: null, code: 401 };
    }

    const event = JSON.parse(rawBody.toString()) as { event: string; data: Record<string, unknown> };
    logger.info(`Paystack webhook: ${event.event}`);

    if (CHARGE_EVENTS.has(event.event)) {
      const reference = (event.data as PaystackWebhookData).reference;
      let verification: Awaited<ReturnType<typeof verifyTransaction>>;
      try {
        verification = await verifyTransaction(reference);
      } catch (error) {
        logger.error(`Paystack webhook: could not verify ${reference}; asking Paystack to retry`, error);
        return { message: 'Verification unavailable', data: null, code: 500 };
      }
      if (!verification.status) {
        logger.warn(`Paystack webhook: Paystack could not verify ${reference}: ${verification.message}`);
        return { message: 'Unverifiable charge ignored', data: 'OK', code: 200 };
      }
      const { action } = await applyChargeOutcome(reference, toChargeReport(verification.data), 'webhook');
      logger.info(`Paystack webhook: ${event.event} for ${reference} -> ${action}`);
    } else if (REFUND_EVENTS.has(event.event)) {
      await applyRefundWebhook(event.event, event.data as unknown as PaystackRefundWebhookData);
    }

    return { message: 'Webhook processed successfully', data: 'OK', code: 200 };
  } catch (error) {
    logger.error(`Paystack webhook: error processing webhook: ${(error as Error).message}`);
    return { message: 'Webhook processing failed', data: null, code: 500 };
  }
};

/** Who is asking for a payment record. */
type PaymentViewer = { userId: string; role?: string };

/**
 * A customer may read only their own transactions; staff may read any. Both lookups below used to
 * return any transaction, with the payer's name and email, to any signed-in user who had its id.
 */
const canViewPayment = (payment: ITransaction, viewer: PaymentViewer): boolean => {
  if (['owner', 'manager', 'employee'].includes(viewer.role ?? '')) return true;
  const owner = payment.userId as unknown as { _id?: { toString(): string } } | { toString(): string } | null;
  const ownerId = owner && '_id' in owner && owner._id ? owner._id.toString() : owner?.toString();
  return !!ownerId && ownerId === viewer.userId;
};

// Restore service methods used by export object
const getPaymentById = async (
  paymentId: string,
  viewer: PaymentViewer
): Promise<CustomResponseType<ITransaction>> => {
  try {
    const payment = await Transaction.findById(paymentId)
      .populate('orderId', 'orderNumber totalAmount items')
      .populate('userId', 'firstName lastName email');

    // Someone else's payment answers exactly like a missing one, so ids cannot be probed.
    if (!payment || !canViewPayment(payment, viewer)) {
      return { message: 'Payment not found', data: null, code: 404 };
    }

    return { message: 'Payment retrieved successfully', data: payment, code: 200 };
  } catch (error) {
    console.error('Error getting payment:', error);
    return { message: 'Failed to retrieve payment', data: null, code: 500 };
  }
};

const getUserPayments = async (
  userId: string,
  page = 1,
  limit = 10
): Promise<CustomResponseType<{ transactions: ITransaction[]; total: number; page: number; limit: number }>> => {
  try {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find({ userId })
        .populate('orderId', 'orderNumber totalAmount items')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Transaction.countDocuments({ userId }),
    ]);

    return {
      message: 'User transactions retrieved successfully',
      data: { transactions, total, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error getting user transactions:', error);
    return { message: 'Failed to retrieve user transactions', data: null, code: 500 };
  }
};

const getPaymentByReference = async (
  reference: string,
  viewer: PaymentViewer
): Promise<CustomResponseType<ITransaction>> => {
  try {
    // `reference` is the field the schema stores; this used to query a `transactionId` field that
    // does not exist, so the lookup never found anything.
    const transaction = await Transaction.findOne({ reference })
      .populate('orderId', 'orderNumber totalAmount items')
      .populate('userId', 'firstName lastName email');

    if (!transaction || !canViewPayment(transaction, viewer)) {
      return { message: 'Transaction not found', data: null, code: 404 };
    }

    return { message: 'Transaction retrieved successfully', data: transaction, code: 200 };
  } catch (error) {
    console.error('Error getting transaction by reference:', error);
    return { message: 'Failed to retrieve transaction', data: null, code: 500 };
  }
};

/** Refunds a payment through Paystack. See refundTransaction for how the refund is settled. */
const refundPayment = async (
  transactionId: string,
  refundData: { amount?: number; reason: string; initiatedBy?: string }
): Promise<CustomResponseType<ITransaction>> =>
  refundTransaction({
    transactionId,
    amount: refundData.amount,
    reason: refundData.reason,
    initiatedBy: refundData.initiatedBy ?? 'unknown',
  });

const TransactionService = {
  initializePayment,
  verifyPayment,
  handleWebhook,
  getPaymentById,
  getUserPayments,
  getPaymentByReference,
  refundPayment,
};

export default TransactionService;
