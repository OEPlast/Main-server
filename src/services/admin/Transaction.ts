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

const TransactionService = {
  getTransactions,
  getTransactionById,
  updateTransaction,
};

export default TransactionService;
