import Transaction from '../models/Transaction';
import Return from '../models/Return';
import Order from '../models/Order';
import mongoose from 'mongoose';
import { CustomResponseType } from '../types/index';

// Input interface
interface CreateReturnTransactionInput {
  returnId: string;
  userId: string;
  amount: number;
  refundMethod: string;
  customerInfo: {
    email: string;
    name: string;
    phone?: string;
  };
}

// Service methods
const createReturnTransaction = async (
  transactionData: CreateReturnTransactionInput
): Promise<CustomResponseType<any>> => {
  try {
    const { returnId, userId, amount, refundMethod, customerInfo } = transactionData;

    // Generate reference
    const reference = `REF-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Map refund method to payment gateway
    const gatewayMap: Record<string, string> = {
      original_payment: 'manual', // Will use Paystack integration
      store_credit: 'manual',
      bank_transfer: 'manual',
    };

    // TODO: Paystack Integration
    // ============================
    // When refundMethod === 'original_payment':
    // 1. Fetch original order transaction
    // 2. Get Paystack transaction reference
    // 3. Call Paystack Refund API:
    //    POST https://api.paystack.co/refund
    //    Body: { transaction: originalReference, amount: amountInKobo }
    // 4. Handle response:
    //    - Success: status='completed', store gatewayRefundId
    //    - Pending: status='pending', store gatewayRefundId
    //    - Failure: status='failed', log error
    // 5. Update gatewayResponse with Paystack data
    // ============================

    const transaction = await Transaction.create({
      returnId: new mongoose.Types.ObjectId(returnId),
      userId: new mongoose.Types.ObjectId(userId),
      transactionType: 'return_refund',
      reference,
      amount: Math.abs(amount), // Store as positive, transactionType indicates it's a refund
      currency: 'NGN',
      paymentMethod: refundMethod as any,
      paymentGateway: gatewayMap[refundMethod] || 'manual',
      status: 'completed', // TODO: Set based on Paystack response
      customerInfo,
      paymentDate: new Date(),
      paidAt: new Date(),
      // TODO: Add gatewayResponse after Paystack integration
      gatewayResponse: {},
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
