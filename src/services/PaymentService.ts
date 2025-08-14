import Payment, { IPayment } from '../models/Payment';
import Order from '../models/Order';
import Transaction from '../models/Transaction';
import eventPublisher from '@/events/eventPublisher';
import { EventType } from '@/events/eventTypes';
import { CustomResponseType } from '@/types';
import crypto from 'crypto';
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
}): Promise<CustomResponseType<{ paymentUrl: string; reference: string; payment: IPayment }>> => {
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

    // Create or upsert transaction pending
    await Transaction.updateOne(
      { reference },
      {
        orderId: paymentData.orderId,
        userId: paymentData.userId,
        reference,
        amount,
        currency,
        gateway: 'paystack',
        status: 'pending',
        metadata: paymentData.metadata,
      },
      { upsert: true }
    );

    // Initialize payment with Paystack
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

    if (!result.status) {
      return {
        message: result.message || 'Failed to initialize payment',
        data: null,
        code: 400,
      };
    }

    // Create payment record
    const payment = new Payment({
      orderId: paymentData.orderId,
      userId: paymentData.userId,
      paymentId: reference,
      paymentMethod: 'paystack',
      paymentGateway: 'paystack',
      amount,
      currency,
      status: 'pending',
      transactionId: result.data.reference,
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
    });

    await payment.save();

    // Update transaction with auth details
    await Transaction.updateOne(
      { reference },
      { authorizationUrl: result.data.authorization_url, accessCode: result.data.access_code }
    );

    return {
      message: 'Payment initialized successfully',
      data: { paymentUrl: result.data.authorization_url, reference: result.data.reference, payment },
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
const verifyPayment = async (reference: string): Promise<CustomResponseType<IPayment>> => {
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

    // Find associated payment by reference
    const payment = await Payment.findOne({ transactionId: reference });
    if (!payment) {
      return { message: 'Payment record not found', data: null, code: 404 };
    }

    // Idempotent update
    const isSuccess = paymentData.status === 'success';
    if (payment.status !== 'completed' && payment.status !== 'failed') {
      payment.status = isSuccess ? 'completed' : 'failed';
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        gatewayTransactionId: toString(paymentData.id),
        responseCode: paymentData.gateway_response,
        responseMessage: paymentData.status,
        metadata: paymentData,
      };
      if (paymentData.fees) {
        payment.fees = { gatewayFee: paymentData.fees / 100, processingFee: 0, totalFees: paymentData.fees / 100 };
      }
      await payment.save();

      // Update Transaction
      await Transaction.updateOne(
        { reference: payment.orderId.toString(), status: 'pending' },
        {
          status: isSuccess ? 'success' : 'failed',
          paidAt: isSuccess ? new Date(paymentData.paid_at || Date.now()) : undefined,
          channel: paymentData.channel,
          gatewayResponse: paymentData,
        }
      );

      // Update Order
      if (isSuccess) {
        await Order.findByIdAndUpdate(payment.orderId, { isPaid: true, paidAt: new Date() });
      }

      // Events
      if (isSuccess) {
        await eventPublisher.publishPaymentSuccessful({
          orderId: payment.orderId.toString(),
          userId: payment.userId.toString(),
          paymentId: payment.id,
          amount: payment.amount,
          paymentMethod: 'paystack',
        });
        await eventPublisher.publishWebsocketOrderUpdate({ orderId: payment.orderId.toString(), status: 'paid' });
      } else {
        await eventPublisher.publishEvent(EventType.PAYMENT_FAILED, {
          orderId: payment.orderId.toString(),
          userId: payment.userId.toString(),
          reference: payment.transactionId,
        });
        await eventPublisher.publishWebsocketOrderUpdate({ orderId: payment.orderId.toString(), status: 'failed' });
      }
    }

    return { message: 'Payment verified successfully', data: payment, code: 200 };
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
    const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!secret) {
      return { message: 'Missing webhook secret', data: null, code: 500 };
    }

    // Use Uint8Array view to satisfy BinaryLike typing while preserving raw bytes
    const hash = crypto.createHmac('sha512', secret).update(new Uint8Array(rawBody)).digest('hex');
    if (hash !== signature) {
      return { message: 'Invalid signature', data: null, code: 401 };
    }

    const event = JSON.parse(rawBody.toString()) as {
      event: string;
      data: PaystackWebhookData;
    };

    if (event.event === 'charge.success' || event.event === 'charge.failed') {
      const data = event.data;
      const reference = data.reference;
      const isSuccess = event.event === 'charge.success';

      // Map to our update flow via verify response-like object
      const payment = await Payment.findOne({ transactionId: reference });
      if (!payment) {
        return { message: 'Payment record not found', data: null, code: 404 };
      }

      if (payment.status === 'completed' || payment.status === 'failed') {
        return { message: 'Already processed', data: 'OK', code: 200 };
      }

      payment.status = isSuccess ? 'completed' : 'failed';
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        gatewayTransactionId: data.id,
        responseCode: data.gateway_response,
        responseMessage: data.status,
        metadata: data,
      };
      if (typeof data.fees === 'number') {
        payment.fees = { gatewayFee: data.fees / 100, processingFee: 0, totalFees: data.fees / 100 };
      }
      await payment.save();

      await Transaction.updateOne(
        { reference: payment.orderId.toString(), status: 'pending' },
        {
          status: isSuccess ? 'success' : 'failed',
          paidAt: isSuccess ? new Date(data.paid_at || Date.now()) : undefined,
          channel: data.channel,
          gatewayResponse: data,
        }
      );

      if (isSuccess) {
        await Order.findByIdAndUpdate(payment.orderId, { isPaid: true, paidAt: new Date() });
        await eventPublisher.publishPaymentSuccessful({
          orderId: payment.orderId.toString(),
          userId: payment.userId.toString(),
          paymentId: payment.id,
          amount: payment.amount,
          paymentMethod: 'paystack',
        });
        await eventPublisher.publishWebsocketOrderUpdate({ orderId: payment.orderId.toString(), status: 'paid' });
      } else {
        await eventPublisher.publishEvent(EventType.PAYMENT_FAILED, {
          orderId: payment.orderId.toString(),
          userId: payment.userId.toString(),
          reference: payment.transactionId,
        });
        await eventPublisher.publishWebsocketOrderUpdate({ orderId: payment.orderId.toString(), status: 'failed' });
      }
    }

    return { message: 'Webhook processed successfully', data: 'OK', code: 200 };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return { message: 'Webhook processing failed', data: null, code: 500 };
  }
};

// Restore service methods used by export object
const getPaymentById = async (paymentId: string): Promise<CustomResponseType<IPayment>> => {
  try {
    const payment = await Payment.findById(paymentId)
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
): Promise<CustomResponseType<{ payments: IPayment[]; total: number; page: number; limit: number }>> => {
  try {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find({ userId })
        .populate('orderId', 'orderNumber totalAmount items')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Payment.countDocuments({ userId }),
    ]);

    return { message: 'User payments retrieved successfully', data: { payments, total, page, limit }, code: 200 };
  } catch (error) {
    console.error('Error getting user payments:', error);
    return { message: 'Failed to retrieve user payments', data: null, code: 500 };
  }
};

const getPaymentByReference = async (reference: string): Promise<CustomResponseType<IPayment>> => {
  try {
    const payment = await Payment.findOne({ transactionId: reference })
      .populate('orderId', 'orderNumber totalAmount items')
      .populate('userId', 'firstName lastName email');

    if (!payment) {
      return { message: 'Payment not found', data: null, code: 404 };
    }

    return { message: 'Payment retrieved successfully', data: payment, code: 200 };
  } catch (error) {
    console.error('Error getting payment by reference:', error);
    return { message: 'Failed to retrieve payment', data: null, code: 500 };
  }
};

const refundPayment = async (
  paymentId: string,
  refundData: { amount?: number; reason: string }
): Promise<CustomResponseType<IPayment>> => {
  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return { message: 'Payment not found', data: null, code: 404 };
    }

    if (payment.status !== 'completed') {
      return { message: 'Cannot refund non-completed payment', data: null, code: 400 };
    }

    const refundAmount = refundData.amount || payment.amount;
    const refundAmountInKobo = refundAmount * 100;

    const paystackResponse = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: payment.transactionId,
        amount: refundAmountInKobo,
        currency: payment.currency,
        customer_note: refundData.reason,
      }),
    });

    const result = (await paystackResponse.json()) as PaystackCreateRefundResponse;

    if (!result.status) {
      return { message: result.message || 'Refund failed', data: null, code: 400 };
    }

    const refundId = `REF_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    payment.refunds.push({
      refundId,
      amount: refundAmount,
      reason: refundData.reason,
      status: 'completed',
      refundDate: new Date(),
      gatewayRefundId: toString(result.data.id),
    });

    const totalRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
    payment.status = totalRefunded >= payment.amount ? 'refunded' : 'partially_refunded';

    await payment.save();

    return { message: 'Payment refunded successfully', data: payment, code: 200 };
  } catch (error) {
    console.error('Error refunding payment:', error);
    return { message: 'Failed to refund payment', data: null, code: 500 };
  }
  // Fallback return to satisfy all code paths
  return { message: 'Unexpected refund state', data: null, code: 500 };
};

const PaymentService = {
  initializePayment,
  verifyPayment,
  handleWebhook,
  getPaymentById,
  getUserPayments,
  getPaymentByReference,
  refundPayment,
};

export default PaymentService;
