import Transaction from '../models/Transaction';
import Return from '../models/Return';
import Order from '../models/Order';
import mongoose from 'mongoose';
import { CustomResponseType } from '../types/index';
import { fireAndLog, sendRefundIssued } from './email/returnEmails';
import { refundTransaction } from './payments/refunds';

// Input interface
interface CreateReturnTransactionInput {
  returnId: string;
  userId: string;
  amount: number;
  refundMethod: string;
  /** The staff member authorizing the refund. */
  adminId: string;
  customerInfo: {
    email: string;
    name: string;
    phone?: string;
  };
}

// Service methods

/**
 * Pays out a return's refund and records it.
 *
 * `original_payment` refunds now go to Paystack against the order's payment; the record stays
 * `pending` until Paystack's refund webhook settles it. Before, every refund was written as
 * `completed` under a "TODO: Paystack Integration" and the customer was emailed that their money
 * was on its way. Store credit and bank transfer are paid outside Paystack by staff, so those are
 * recorded as the admin's statement that the payout was made.
 */
const createReturnTransaction = async (
  transactionData: CreateReturnTransactionInput
): Promise<CustomResponseType<any>> => {
  try {
    const { returnId, userId, amount, refundMethod, adminId, customerInfo } = transactionData;

    const returnDoc = await Return.findById(returnId).select('order returnNumber type items');
    if (!returnDoc?.order) {
      return { message: 'Return or its order not found', data: null, code: 404 };
    }

    const reference = `REF-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    let status: 'completed' | 'pending' = 'completed';
    let paymentGateway: 'paystack' | 'manual' = 'manual';
    let gatewayResponse: Record<string, unknown> = {};

    if (refundMethod === 'original_payment') {
      const payment = await Transaction.findOne({
        orderId: returnDoc.order,
        transactionType: 'order_payment',
        status: { $in: ['completed', 'partially_refunded'] },
      });
      if (!payment) {
        return { message: 'No Paystack payment was found for this order to refund', data: null, code: 400 };
      }

      const refund = await refundTransaction({
        transactionId: payment._id as mongoose.Types.ObjectId,
        amount: Math.abs(amount),
        reason: `Return ${returnDoc.returnNumber}`,
        initiatedBy: adminId,
      });
      if (refund.code !== 200 || !refund.data) {
        // Nothing is recorded and the return is left as it was, so staff can retry.
        return { message: refund.message, data: null, code: refund.code };
      }

      const entry = refund.data.refunds[refund.data.refunds.length - 1];
      status = entry?.status === 'completed' ? 'completed' : 'pending';
      paymentGateway = 'paystack';
      gatewayResponse = {
        transactionReference: payment.reference,
        gatewayTransactionId: entry?.gatewayRefundId,
        responseMessage: 'Refund requested from Paystack',
      };
    }

    const transaction = await Transaction.create({
      returnId: new mongoose.Types.ObjectId(returnId),
      userId: new mongoose.Types.ObjectId(userId),
      transactionType: 'return_refund',
      reference,
      amount: Math.abs(amount), // Store as positive, transactionType indicates it's a refund
      currency: 'NGN',
      paymentMethod: refundMethod as any,
      paymentGateway,
      status,
      customerInfo,
      paymentDate: new Date(),
      paidAt: status === 'completed' ? new Date() : undefined,
      gatewayResponse,
      metadata: { authorizedBy: adminId, manual: paymentGateway === 'manual' },
    });

    // Link transaction to return
    const updatedReturn = await Return.findByIdAndUpdate(
      returnId,
      { refundTransaction: transaction._id },
      { new: true }
    );

    // Stamp the order's refund event time. The Transaction remains the
    // authoritative record of refund amounts and partials — this is the
    // first-refund marker that lets "refunds by month" be answered from the
    // Order collection without a join. Only set once, so a second partial
    // refund does not rewrite when the order was first refunded.
    if (updatedReturn?.order) {
      await Order.updateOne(
        { _id: updatedReturn.order, refundedAt: { $exists: false } },
        { $set: { refundedAt: new Date() } }
      );

      // Sent only now that the refund has really been requested (or, for a manual method, recorded).
      const order = await Order.findById(updatedReturn.order).select('products').lean();
      fireAndLog(
        sendRefundIssued({
          orderId: updatedReturn.order.toString(),
          returnId: returnId,
          returnNumber: updatedReturn.returnNumber,
          returnType: updatedReturn.type,
          items: updatedReturn.items,
          orderLineIds: (order?.products ?? []).map((p: any) => p.product.toString()),
          refundAmount: Math.abs(amount),
          refundMethod,
          refundReference: reference,
          refundedAt: new Date(),
        }),
        `order-refunded for ${updatedReturn.returnNumber}`
      );
    }

    return {
      message: 'Return transaction created successfully',
      data: transaction,
      code: 201,
    };
  } catch (error) {
    console.error('Error creating return transaction:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to create return transaction',
      data: null,
      code: 500,
    };
  }
};

const getReturnTransactions = async (
  returnId: string
): Promise<CustomResponseType<any[]>> => {
  try {
    const transactions = await Transaction.find({
      returnId: new mongoose.Types.ObjectId(returnId),
      transactionType: 'return_refund',
    }).lean();

    return {
      message: 'Return transactions fetched successfully',
      data: transactions,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching return transactions:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch return transactions',
      data: [],
      code: 500,
    };
  }
};

// Export service
const ReturnTransactionService = {
  createReturnTransaction,
  getReturnTransactions,
};

export default ReturnTransactionService;
