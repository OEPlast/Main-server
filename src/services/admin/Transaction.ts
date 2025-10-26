import mongoose from 'mongoose';
import Transaction, { ITransaction, TransactionStatus, PaymentMethod, TransactionGateway } from '../../models/Transaction';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';

interface TransactionFilters {
  status?: TransactionStatus;
  paymentMethod?: PaymentMethod;
  paymentGateway?: TransactionGateway;
  userId?: string;
  orderId?: string;
  dateRange?: { start: Date; end: Date };
  amountRange?: { min: number; max: number };
  reference?: string;
  transactionId?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Fetches transactions with optional filters and pagination
 * @param page - Current page number
 * @param limit - Number of transactions per page
 * @param filters - Filters for searching transactions
 */
const getTransactions = async (
  page: number = 1,
  limit: number = 10,
  filters: TransactionFilters = {}
): Promise<CustomResponseTypeWithMeta<ITransaction[], PaginationMeta>> => {
  try {
    const pipeline: mongoose.PipelineStage[] = [];
    const matchStage: Record<string, unknown> = {};

    // Apply filters
    if (filters.status) matchStage.status = filters.status;
    if (filters.paymentMethod) matchStage.paymentMethod = filters.paymentMethod;
    if (filters.paymentGateway) matchStage.paymentGateway = filters.paymentGateway;
    if (filters.userId) matchStage.userId = new mongoose.Types.ObjectId(filters.userId);
    if (filters.orderId) matchStage.orderId = new mongoose.Types.ObjectId(filters.orderId);
    if (filters.reference) matchStage.reference = { $regex: filters.reference, $options: 'i' };
    if (filters.transactionId) matchStage._id = { $regex: filters.transactionId, $options: 'i' };
    
    if (filters.dateRange) {
      matchStage.paymentDate = { 
        $gte: filters.dateRange.start, 
        $lte: filters.dateRange.end 
      };
    }
    
    if (filters.amountRange) {
      matchStage.amount = {
        ...(filters.amountRange.min && { $gte: filters.amountRange.min }),
        ...(filters.amountRange.max && { $lte: filters.amountRange.max }),
      };
    }

    pipeline.push({ $match: matchStage });

    // Populate user and order details
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
        pipeline: [
          {
            $project: {
              firstName: 1,
              lastName: 1,
              _id: 1
            },
          },
        ],
      },
    });

    pipeline.push({
      $lookup: {
        from: 'orders',
        localField: 'orderId',
        foreignField: '_id',
        as: 'order',
        pipeline: [
          {
            $project: {
              _id: 1,
              total: 1,
              isPaid: 1,
            },
          },
        ],
      },
    });

    // Unwind populated arrays (expecting single documents)
    pipeline.push(
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } }
    );

    // Sort by payment date (most recent first)
    pipeline.push({ $sort: { paymentDate: -1 } });

    // Count total documents before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Transaction.aggregate(countPipeline);
    const total = totalResult[0]?.total || 0;

    // Add pagination
    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip }, { $limit: limit });

    const transactions = await Transaction.aggregate(pipeline);

    // Calculate pagination meta
    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return {
      message: 'Transactions retrieved successfully',
      data: transactions,
      code: 200,
      meta,
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return {
      message: 'Failed to fetch transactions',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches a single transaction by its ID
 * @param transactionId - The ID of the transaction to fetch
 */
const getTransactionById = async (transactionId: string): Promise<CustomResponseType<ITransaction>> => {
  try {
    const pipeline: mongoose.PipelineStage[] = [
      { $match: { _id: new mongoose.Types.ObjectId(transactionId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                phoneNumber: 1,
                role: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
          pipeline: [
            {
              $project: {
                _id: 1,
                total: 1,
                status: 1,
                deliveryStatus: 1,
                products: 1,
                shippingAddress: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
    ];

    const result = await Transaction.aggregate(pipeline);
    const transaction = result[0];

    if (!transaction) {
      return {
        message: 'Transaction not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Transaction retrieved successfully',
      data: transaction,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching transaction by ID:', error);
    return {
      message: 'Failed to fetch transaction',
      data: null,
      code: 500,
    };
  }
};


/**
 * Updates a transaction by its ID
 * @param transactionId - The ID of the transaction to update
 * @param updateData - The data to update
 */
const updateTransaction = async (
  transactionId: string,
  updateData: Partial<ITransaction>
): Promise<CustomResponseType<ITransaction>> => {
  try {
    // Find and update the transaction
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedTransaction) {
      return {
        message: 'Transaction not found',
        data: null,
        code: 404,
      };
    }

    // Populate the updated transaction with user and order details
    const populatedTransaction = await Transaction.aggregate([
      { $match: { _id: updatedTransaction._id } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                phoneNumber: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
          pipeline: [
            {
              $project: {
                _id: 1,
                total: 1,
                status: 1,
                deliveryStatus: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
    ]);

    return {
      message: 'Transaction updated successfully',
      data: populatedTransaction[0],
      code: 200,
    };
  } catch (error) {
    console.error('Error updating transaction:', error);
    return {
      message: 'Failed to update transaction',
      data: null,
      code: 500,
    };
  }
};

/**
 * Get transaction statistics
 */
const getStatistics = async (): Promise<CustomResponseType<any>> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run aggregations in parallel
    const [
      total,
      completed,
      pending,
      failed,
      cancelled,
      refunded,
      partiallyRefunded,
      revenueData,
      refundData,
      gatewayStats,
      methodStats,
      recentTransactions,
      todayRevenueData,
      monthlyRevenueData,
    ] = await Promise.all([
      // Total transactions
      Transaction.countDocuments(),
      
      // Completed transactions
      Transaction.countDocuments({ status: 'completed' }),
      
      // Pending transactions
      Transaction.countDocuments({ status: 'pending' }),
      
      // Failed transactions
      Transaction.countDocuments({ status: 'failed' }),
      
      // Cancelled transactions
      Transaction.countDocuments({ status: 'cancelled' }),
      
      // Refunded transactions
      Transaction.countDocuments({ status: 'refunded' }),
      
      // Partially refunded transactions
      Transaction.countDocuments({ status: 'partially_refunded' }),
      
      // Total revenue (completed transactions)
      Transaction.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      
      // Total refunded amount
      Transaction.aggregate([
        { $match: { status: { $in: ['refunded', 'partially_refunded'] } } },
        { $unwind: '$refunds' },
        { $match: { 'refunds.status': 'completed' } },
        { $group: { _id: null, total: { $sum: '$refunds.amount' } } },
      ]),
      
      // Transactions by gateway
      Transaction.aggregate([
        { $group: { _id: '$paymentGateway', count: { $sum: 1 } } },
      ]),
      
      // Transactions by payment method
      Transaction.aggregate([
        { $group: { _id: '$paymentMethod', count: { $sum: 1 } } },
      ]),
      
      // Recent transactions (last 7 days)
      Transaction.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      
      // Today's revenue
      Transaction.aggregate([
        { $match: { status: 'completed', paidAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      
      // Monthly revenue
      Transaction.aggregate([
        { $match: { status: 'completed', paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalRevenue = revenueData[0]?.total || 0;
    const totalRevenueCount = revenueData[0]?.count || 0;
    const totalRefunded = refundData[0]?.total || 0;
    const averageTransactionValue = totalRevenueCount > 0 ? totalRevenue / totalRevenueCount : 0;

    // Format gateway and method statistics
    const transactionsByGateway: { [key: string]: number } = {};
    gatewayStats.forEach((stat) => {
      transactionsByGateway[stat._id] = stat.count;
    });

    const transactionsByMethod: { [key: string]: number } = {};
    methodStats.forEach((stat) => {
      transactionsByMethod[stat._id] = stat.count;
    });

    const statistics = {
      total,
      completed,
      pending,
      failed,
      cancelled,
      refunded,
      partially_refunded: partiallyRefunded,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalRefunded: Number(totalRefunded.toFixed(2)),
      averageTransactionValue: Number(averageTransactionValue.toFixed(2)),
      transactionsByGateway,
      transactionsByMethod,
      recentTransactions,
      todayRevenue: Number((todayRevenueData[0]?.total || 0).toFixed(2)),
      monthlyRevenue: Number((monthlyRevenueData[0]?.total || 0).toFixed(2)),
    };

    return {
      message: 'Transaction statistics fetched successfully',
      data: statistics,
      code: 200,
    };
  } catch (error) {
    console.error('Error getting transaction statistics:', error);
    return {
      message: 'Failed to fetch transaction statistics',
      data: null,
      code: 500,
    };
  }
};

/**
 * Process refund for a transaction
 */
const processRefund = async (
  transactionId: string,
  amount: number,
  reason: string,
  adminId: string
): Promise<CustomResponseType<ITransaction>> => {
  try {
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return {
        message: 'Transaction not found',
        data: null,
        code: 404,
      };
    }

    // Validate transaction status
    if (transaction.status !== 'completed') {
      return {
        message: 'Only completed transactions can be refunded',
        data: null,
        code: 400,
      };
    }

    // Calculate total already refunded
    const totalRefunded = transaction.refunds.reduce((sum, refund) => {
      if (refund.status === 'completed') {
        return sum + refund.amount;
      }
      return sum;
    }, 0);

    // Validate refund amount
    const availableForRefund = transaction.amount - totalRefunded;
    if (amount > availableForRefund) {
      return {
        message: `Refund amount exceeds available amount. Available: ${availableForRefund}`,
        data: null,
        code: 400,
      };
    }

    if (amount <= 0) {
      return {
        message: 'Refund amount must be greater than 0',
        data: null,
        code: 400,
      };
    }

    // Create refund entry
    const refundId = new mongoose.Types.ObjectId().toString();
    const newRefund = {
      refundId,
      amount,
      reason,
      status: 'completed' as const,
      refundDate: new Date(),
    };

    // Update transaction
    transaction.refunds.push(newRefund);
    
    // Update status
    const newTotalRefunded = totalRefunded + amount;
    if (newTotalRefunded >= transaction.amount) {
      transaction.status = 'refunded';
    } else {
      transaction.status = 'partially_refunded';
    }

    await transaction.save();

    // Populate and return
    const populatedTransaction = await Transaction.aggregate([
      { $match: { _id: transaction._id } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                phoneNumber: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
          pipeline: [
            {
              $project: {
                _id: 1,
                total: 1,
                status: 1,
                deliveryStatus: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
    ]);

    return {
      message: 'Refund processed successfully',
      data: populatedTransaction[0],
      code: 200,
    };
  } catch (error) {
    console.error('Error processing refund:', error);
    return {
      message: 'Failed to process refund',
      data: null,
      code: 500,
    };
  }
};

const TransactionService = {
  getTransactions,
  getTransactionById,
  updateTransaction,
  getStatistics,
  processRefund,
};

export default TransactionService;
