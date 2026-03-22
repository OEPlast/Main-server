import Transaction, { ITransaction } from '../models/Transaction';
import Order from '../models/Order';
import Product from '../models/Product';
import GIGConfig from '@/models/GIGConfig';
import mongoose from 'mongoose';
import eventPublisher from '@/events/eventPublisher';
import { EventType } from '@/events/eventTypes';
import { reverseSaleCountersOnCancel } from '@/helpers/saleOrderUtils';
import { CustomResponseType } from '@/types';
import { logger } from '@/lib/logger';
import ShipmentService from './ShipmentService';
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
    console.log(amountInKobo);

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
        const order = await Order.findByIdAndUpdate(
          transaction.orderId,
          { isPaid: true, paidAt: new Date() },
          { new: true }
        ).populate([
          {
            path: 'user',
            select: 'email firstName lastName',
          },
          {
            path: 'products.product',
            select: 'name description_images category price',
          },
          {
            path: 'shipmentId',
            select: 'courier _id',
          },
        ]);

        // Update order status to Processing
        await Order.findByIdAndUpdate(transaction.orderId, { status: 'Processing' });

        // Create shipment if delivery type is shipping
        if (order && order.deliveryType === 'shipping') {
          try {
            const shipmentResult = await ShipmentService.createShipmentForOrder(transaction.orderId.toString());
            if (shipmentResult) {
              logger.info(
                `Shipment created for order ${transaction.orderId.toString()} - Tracking: ${
                  shipmentResult.trackingNumber
                }`
              );
            }
          } catch (shipmentError) {
            logger.error(
              `Failed to create shipment for order ${transaction.orderId.toString()}: ${
                (shipmentError as Error).message
              }`
            );
            // Don't fail payment verification if shipment creation fails
          }
        }
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

          // Reverse sale counters using session for atomicity
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            await reverseSaleCountersOnCancel(
              order.products
                .filter((item) => item.product && item.qty)
                .map((item) => ({
                  product: item.product!,
                  qty: item.qty!,
                  sale: (item as any).sale || undefined,
                  saleSnapshot: (item as any).saleSnapshot,
                })),
              session
            );
            await session.commitTransaction();
            logger.info(`Sale counters reversed for order ${transaction.orderId.toString()}`);
          } catch (err) {
            await session.abortTransaction();
            logger.error(`Failed to reverse sale counters for order ${transaction.orderId.toString()}:`, err);
          } finally {
            session.endSession();
          }

          // Update order status to Cancelled
          await Order.findByIdAndUpdate(transaction.orderId, { status: 'Cancelled' });
        }
      }

      // Events
      if (isSuccess && transaction.orderId) {
        // Publish ORDER_SUCCESSFUL event to trigger email confirmation
        await publishOrderSuccessfulEvent(transaction.orderId.toString());

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

        // Update order to paid
        const order = await Order.findByIdAndUpdate(
          transaction.orderId,
          { isPaid: true, paidAt: new Date() },
          { new: true }
        ).populate([
          {
            path: 'user',
            select: 'email firstName lastName',
          },
          {
            path: 'products.product',
            select: 'name description_images category price',
          },
          {
            path: 'shipmentId',
            select: 'courier _id',
          },
        ]);

        // Update order status to Processing
        await Order.findByIdAndUpdate(transaction.orderId, { status: 'Processing' });

        // Create shipment if delivery type is shipping
        if (order && order.deliveryType === 'shipping') {
          try {
            const shipmentResult = await ShipmentService.createShipmentForOrder(transaction.orderId.toString());
            if (shipmentResult) {
              logger.info(
                `Paystack webhook: Shipment created for order ${transaction.orderId.toString()} - Tracking: ${
                  shipmentResult.trackingNumber
                }`
              );
            }
          } catch (shipmentError) {
            logger.error(
              `Paystack webhook: Failed to create shipment for order ${transaction.orderId.toString()}: ${
                (shipmentError as Error).message
              }`
            );
            // Don't fail webhook processing if shipment creation fails
          }
        }

        // Publish ORDER_SUCCESSFUL event to trigger email confirmation
        await publishOrderSuccessfulEvent(transaction.orderId.toString());

        // Publish PAYMENT_SUCCESSFUL event (match verifyPayment behavior)
        await eventPublisher.publishPaymentSuccessful({
          orderId: transaction.orderId.toString(),
          userId: transaction.userId.toString(),
          paymentId: (transaction._id as mongoose.Types.ObjectId).toString(),
          amount: transaction.amount,
          paymentMethod: 'paystack',
        });

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

          // Update order status to Cancelled
          await Order.findByIdAndUpdate(transaction.orderId, { status: 'Cancelled' });
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

/**
 * Helper function to publish ORDER_SUCCESSFUL event with complete order data
 * Reusable in both verifyPayment and handleWebhook
 */
const publishOrderSuccessfulEvent = async (orderId: string): Promise<void> => {
  try {
    const order = await Order.findById(orderId).populate([
      {
        path: 'user',
        select: 'email firstName lastName',
      },
      {
        path: 'products.product',
        select: 'name description_images category price',
      },
      {
        path: 'shipmentId',
        select: 'courier _id',
      },
    ]);

    if (!order) {
      logger.warn(`publishOrderSuccessfulEvent: Order ${orderId} not found`);
      return;
    }

    const populatedUser = order.user as unknown as {
      email: string;
      firstName: string;
      lastName: string;
    };

    const populatedProducts = order.products as unknown as Array<{
      product: {
        name: string;
        description_images?: Array<{ url: string; cover_image?: boolean }>;
        category?: string;
        price?: number;
      };
      qty?: number;
      price?: number;
    }>;

    const gigConfig = await GIGConfig.findOne().lean();
    const shippingMinDays =
      typeof gigConfig?.shippingMinDeliveryDays === 'number' ? Math.max(0, gigConfig.shippingMinDeliveryDays) : 2;
    const shippingMaxDaysBase =
      typeof gigConfig?.shippingMaxDeliveryDays === 'number' ? Math.max(0, gigConfig.shippingMaxDeliveryDays) : 5;
    const shippingMaxDays = Math.max(shippingMinDays, shippingMaxDaysBase);
    const deliveryEstimateLabel = `${shippingMinDays} - ${shippingMaxDays} days`;
    const pickupContactName = gigConfig?.senderName || process.env.STORE_NAME || 'Store Pickup';
    const pickupContactPhone = gigConfig?.senderPhoneNumber || process.env.STORE_PHONE || '';
    const pickupAddress = gigConfig?.senderAddress || process.env.STORE_ADDRESS || 'Store Pickup';

    // Determine courier and address based on delivery type
    let courier = 'Standard Shipping';
    let address = '';

    if (order.deliveryType === 'pickup') {
      courier = 'Pickup';
      address = pickupAddress;
    } else {
      // For shipping, try to get courier from shipment if available
      const populatedShipment = order.shipmentId as unknown as { courier?: string } | null;
      courier = populatedShipment?.courier || 'Standard Shipping';
      address = `${order.shippingAddress?.address1 || ''}, ${order.shippingAddress?.city || ''}, ${
        order.shippingAddress?.state || ''
      }`.trim();
    }

    console.log({ shipmentId: order.shipmentId });

    await eventPublisher.publishOrderSuccessful({
      email: populatedUser.email,
      firstName: populatedUser.firstName,
      lastName: populatedUser.lastName,
      purchaseDate: order.createdAt,
      orderId: order._id.toString(),
      shipping: {
        courier,
        address,
        _id: order.shipmentId?._id.toString() || '',
        deliveryEstimateLabel: order.deliveryType === 'pickup' ? undefined : deliveryEstimateLabel,
        pickupContactName: order.deliveryType === 'pickup' ? pickupContactName : undefined,
        pickupContactPhone: order.deliveryType === 'pickup' ? pickupContactPhone : undefined,
        pickupAddress: order.deliveryType === 'pickup' ? pickupAddress : undefined,
      },
      deliveryType: order.deliveryType,
      gigWaybill: order.gigWaybill || undefined,
      products: populatedProducts.map((item) => {
        // Find cover image or fallback to first image
        const coverImage = item.product.description_images?.find((img) => img.cover_image === true);
        const imageUrl = coverImage?.url || item.product.description_images?.[0]?.url || '';

        return {
          name: item.product.name,
          imagePath: imageUrl,
          category: item.product.category,
          price: item.price || item.product.price || 0,
          quantity: item.qty || 0,
          subtotal: (item.price || item.product.price || 0) * (item.qty || 0),
        };
      }),
      payment: {
        totalShopping: order.totalBeforeDiscount || order.total || 0,
        shipping: order.shippingPrice || 0,
        tax: order.taxPrice || 0,
        discount: order.couponDiscount || 0,
        subtotal: order.total || 0,
      },
      orderStatusLink: `${process.env.FRONTEND_URL}/orders/${order._id.toString()}`,
    });

    logger.info(`publishOrderSuccessfulEvent: ORDER_SUCCESSFUL event published for order ${orderId}`);
  } catch (error) {
    logger.error(`publishOrderSuccessfulEvent: Failed to publish ORDER_SUCCESSFUL event for order ${orderId}:`, error);
    // Don't throw - we don't want to fail payment verification if event publishing fails
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
