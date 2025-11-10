import Transaction, { ITransaction } from '../models/Transaction';
import Order from '../models/Order';
import Product from '../models/Product';
import mongoose from 'mongoose';
import eventPublisher from '@/events/eventPublisher';
import { EventType } from '@/events/eventTypes';
import { CustomResponseType } from '@/types';
import { logger } from '@/lib/logger';
import crypto, { randomUUID } from 'crypto';
import {
  PaystackCreateRefundResponse,
  PaystackInitializeData,
  PaystackResponse,
  PaystackVerifyTransactionResponse,
  PaystackWebhookData,
} from '@/types/paystack';
import { toString } from 'express-validator/lib/utils';

const initializePayment = async (paymentData: {
  orderId: string;
  userId: string;
  email: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}): Promise<CustomResponseType<{ paymentUrl: string; reference: string; transaction: ITransaction }>> => {
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
    const amountInKobo = currency === 'NGN' ? amount * 100 : amount;

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
    });

    const result = (await paystackResponse.json()) as PaystackResponse;

    console.log(result);

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
      data: { paymentUrl: result.data.authorization_url, reference: result.data.reference, transaction },
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
 * Verify payment with Paystack
 */
const verifyPayment = async (reference: string): Promise<CustomResponseType<ITransaction>> => {
  try {
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const result = (await paystackResponse.json()) as PaystackVerifyTransactionResponse;

    if (!result.status) {
      return {
        message: result.message || 'Payment verification failed',
        data: null,
        code: 400,
      };
    }

    const paymentData = result.data;

    // Find associated paystack reference
    const transaction = await Transaction.findOne({ reference: reference });
    if (!transaction) {
      return { message: 'Transaction record not found', data: null, code: 404 };
    }
    if (!transaction.orderId) {
      return { message: 'Order not found for transaction', data: null, code: 404 };
    }

    // Idempotent update
    const isSuccess = paymentData.status === 'success';
    if (transaction.status !== 'completed' && transaction.status !== 'failed') {
      transaction.status = isSuccess ? 'completed' : 'failed';
      transaction.gatewayResponse = {
        ...transaction.gatewayResponse,
        gatewayTransactionId: toString(paymentData.id),
        responseCode: paymentData.gateway_response,
        responseMessage: paymentData.status,
        metadata: paymentData,
      };
      if (paymentData.fees) {
        transaction.fees = { gatewayFee: paymentData.fees / 100, processingFee: 0, totalFees: paymentData.fees / 100 };
      }
      transaction.paidAt = isSuccess ? new Date(paymentData.paid_at || Date.now()) : undefined;
      transaction.channel = paymentData.channel;
      await transaction.save();

      // Update Order
      if (isSuccess && transaction.orderId) {
        await Order.findByIdAndUpdate(transaction.orderId, { isPaid: true, paidAt: new Date() });
      } else if (!isSuccess && transaction.orderId) {
        // Restore stock when payment fails
        const order = await Order.findById(transaction.orderId);
        if (order && order.products && order.products.length > 0) {
          logger.info(`Payment failed - Restoring stock for order ${transaction.orderId.toString()}`);

          const bulkUpdates = order.products.map((item) => ({
            updateOne: {
              filter: { _id: item.product },
              update: { $inc: { stock: item.qty || 0 } },
            },
          }));

          await Product.bulkWrite(bulkUpdates);
          logger.info(
            `Stock restored for ${order.products.length} products in order ${transaction.orderId.toString()}`
          );
        }
      }

      // Events
      if (isSuccess && transaction.orderId) {
        await eventPublisher.publishPaymentSuccessful({
          orderId: transaction.orderId.toString(),
          userId: transaction.userId.toString(),
          paymentId: (transaction._id as mongoose.Types.ObjectId).toString(),
          amount: transaction.amount,
          paymentMethod: 'paystack',
        });
        await eventPublisher.publishWebsocketOrderUpdate({ orderId: transaction.orderId.toString(), status: 'paid' });
      } else if (!isSuccess && transaction.orderId) {
        await eventPublisher.publish(EventType.PAYMENT_FAILED, {
          orderId: transaction.orderId.toString(),
          userId: transaction.userId.toString(),
          reference: transaction.reference,
        });
        await eventPublisher.publishWebsocketOrderUpdate({ orderId: transaction.orderId.toString(), status: 'failed' });
      }
    }

    return { message: 'Payment reference verified successfully', data: transaction, code: 200 };
  } catch (error) {
    console.error('Error verifying payment:', error);
    return { message: 'Failed to verify payment', data: null, code: 500 };
  }
};

/**
 * Handle Paystack webhook (raw buffer)
 */
const handleWebhook = async (rawBody: Buffer, signature: string): Promise<CustomResponseType<string>> => {
  try {
    logger.info(
      `Paystack webhook: received (rawBytes=${rawBody?.length ?? 0}, signaturePrefix=${
        signature ? signature.slice(0, 8) + '…' : 'none'
      })`
    );
    const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('Paystack webhook: missing webhook secret');
      return { message: 'Missing webhook secret', data: null, code: 500 };
    }

    // Use Uint8Array view to satisfy BinaryLike typing while preserving raw bytes
    const hash = crypto.createHmac('sha512', secret).update(new Uint8Array(rawBody)).digest('hex');
    logger.debug(`Paystack webhook: computed HMAC (hashPrefix=${hash.slice(0, 8)}…)`);
    if (hash !== signature) {
      logger.warn('Paystack webhook: signature mismatch');
      return { message: 'Invalid signature', data: null, code: 401 };
    }

    const event = JSON.parse(rawBody.toString()) as {
      event: string;
      data: PaystackWebhookData;
    };
    logger.info(`Paystack webhook: event parsed (type=${event.event})`);

    if (event.event === 'charge.success' || event.event === 'charge.failed') {
      const data = event.data;
      const reference = data.reference;
      const isSuccess = event.event === 'charge.success';
      logger.debug(
        `Paystack webhook: processing charge event (reference=${reference}, success=${isSuccess}, id=${data.id})`
      );

      // Map to our update flow via verify response-like object
      const transaction = await Transaction.findOne({ reference: reference });
      if (!transaction) {
        logger.warn(`Paystack webhook: transaction not found (reference=${reference})`);
        return { message: 'Transaction record not found', data: null, code: 404 };
      }

      if (transaction.status === 'completed' || transaction.status === 'failed') {
        logger.info(
          `Paystack webhook: transaction already processed (transactionId=${transaction.id}, status=${transaction.status})`
        );
        return { message: 'Already processed', data: 'OK', code: 200 };
      }

      logger.debug(
        `Paystack webhook: updating transaction status (transactionId=${transaction.id}) → ${
          isSuccess ? 'completed' : 'failed'
        }`
      );
      transaction.status = isSuccess ? 'completed' : 'failed';
      transaction.gatewayResponse = {
        ...transaction.gatewayResponse,
        gatewayTransactionId: data.id,
        responseCode: data.gateway_response,
        responseMessage: data.status,
        metadata: data,
      };
      if (typeof data.fees === 'number') {
        transaction.fees = { gatewayFee: data.fees / 100, processingFee: 0, totalFees: data.fees / 100 };
      }
      transaction.paidAt = isSuccess ? new Date(data.paid_at || Date.now()) : undefined;
      transaction.channel = data.channel;
      await transaction.save();
      logger.debug(
        `Paystack webhook: transaction saved (transactionId=${(
          transaction._id as mongoose.Types.ObjectId
        ).toString()}, status=${transaction.status})`
      );

      if (isSuccess && transaction.orderId) {
        logger.info(`Paystack webhook: marking order as paid (orderId=${transaction.orderId.toString()})`);
        await Order.findByIdAndUpdate(transaction.orderId, { isPaid: true, paidAt: new Date() });
        await eventPublisher.publishPaymentSuccessful({
          orderId: transaction.orderId.toString(),
          userId: transaction.userId.toString(),
          paymentId: (transaction._id as mongoose.Types.ObjectId).toString(),
          amount: transaction.amount,
          paymentMethod: 'paystack',
        });
        logger.info(`Paystack webhook: published payment successful event (orderId=${transaction.orderId.toString()})`);
        await eventPublisher.publishWebsocketOrderUpdate({ orderId: transaction.orderId.toString(), status: 'paid' });
        logger.debug(
          `Paystack webhook: published websocket update (orderId=${transaction.orderId.toString()}, status=paid)`
        );
      } else if (!isSuccess && transaction.orderId) {
        // Restore stock when payment fails via webhook
        const order = await Order.findById(transaction.orderId);
        if (order && order.products && order.products.length > 0) {
          logger.info(`Paystack webhook: payment failed - restoring stock for order ${transaction.orderId.toString()}`);

          const bulkUpdates = order.products.map((item) => ({
            updateOne: {
              filter: { _id: item.product },
              update: { $inc: { stock: item.qty || 0 } },
            },
          }));

          await Product.bulkWrite(bulkUpdates);
          logger.info(
            `Paystack webhook: stock restored for ${
              order.products.length
            } products in order ${transaction.orderId.toString()}`
          );
        }

        await eventPublisher.publish(EventType.PAYMENT_FAILED, {
          orderId: transaction.orderId.toString(),
          userId: transaction.userId.toString(),
          reference: transaction.reference,
        });
        logger.info(`Paystack webhook: published payment failed event (orderId=${transaction.orderId.toString()})`);
        await eventPublisher.publishWebsocketOrderUpdate({ orderId: transaction.orderId.toString(), status: 'failed' });
        logger.debug(
          `Paystack webhook: published websocket update (orderId=${transaction.orderId.toString()}, status=failed)`
        );
      }
    }

    logger.info('Paystack webhook: processed successfully');
    return { message: 'Webhook processed successfully', data: 'OK', code: 200 };
  } catch (error) {
    logger.error(`Paystack webhook: error processing webhook: ${(error as Error).message}`);
    return { message: 'Webhook processing failed', data: null, code: 500 };
  }
};

// Restore service methods used by export object
const getPaymentById = async (paymentId: string): Promise<CustomResponseType<ITransaction>> => {
  try {
    const payment = await Transaction.findById(paymentId)
      .populate('orderId', 'orderNumber totalAmount items')
      .populate('userId', 'firstName lastName email');

    if (!payment) {
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

const getPaymentByReference = async (reference: string): Promise<CustomResponseType<ITransaction>> => {
  try {
    const transaction = await Transaction.findOne({ transactionId: reference })
      .populate('orderId', 'orderNumber totalAmount items')
      .populate('userId', 'firstName lastName email');

    if (!transaction) {
      return { message: 'Transaction not found', data: null, code: 404 };
    }

    return { message: 'Transaction retrieved successfully', data: transaction, code: 200 };
  } catch (error) {
    console.error('Error getting transaction by reference:', error);
    return { message: 'Failed to retrieve transaction', data: null, code: 500 };
  }
};

const refundPayment = async (
  transactionId: string,
  refundData: { amount?: number; reason: string }
): Promise<CustomResponseType<ITransaction>> => {
  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return { message: 'Transaction not found', data: null, code: 404 };
    }

    if (transaction.status !== 'completed') {
      return { message: 'Cannot refund non-completed transaction', data: null, code: 400 };
    }

    const refundAmount = refundData.amount || transaction.amount;
    const refundAmountInKobo = refundAmount * 100;

    const paystackResponse = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: transaction.reference,
        amount: refundAmountInKobo,
        currency: transaction.currency,
        customer_note: refundData.reason,
        merchant_note: refundData.reason,
      }),
    });

    const result = (await paystackResponse.json()) as PaystackCreateRefundResponse;

    if (!result.status) {
      return { message: result.message || 'Refund failed', data: null, code: 400 };
    }

    const refundId = `REF_${randomUUID()}`;
    transaction.refunds.push({
      refundId,
      amount: refundAmount,
      reason: refundData.reason,
      status: 'completed',
      refundDate: new Date(),
      gatewayRefundId: toString(result.data.id),
    });

    const totalRefunded = transaction.refunds.reduce((sum: number, r: ITransaction['refunds'][0]) => sum + r.amount, 0);
    transaction.status = totalRefunded >= transaction.amount ? 'refunded' : 'partially_refunded';

    await transaction.save();

    return { message: 'Transaction refunded successfully', data: transaction, code: 200 };
  } catch (error) {
    console.error('Error refunding transaction:', error);
    return { message: 'Failed to refund transaction', data: null, code: 500 };
  }
};

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
