import { Request, Response } from 'express';
import TransactionService from '../../services/admin/Transaction';

// Get all transactions with filtering and pagination
const getTransactions = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentMethod,
      transactionType,
      userId,
      orderId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
    } = req.query;

    const filters: Record<string, unknown> = {};

    if (status) filters.status = status;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (transactionType) filters.transactionType = transactionType;
    if (userId) filters.userId = userId;
    if (orderId) filters.orderId = orderId;
    if (search) filters.search = search;

    if (startDate && endDate) {
      filters.dateRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string),
      };
    }

    if (minAmount || maxAmount) {
      const amountRange: { min?: number; max?: number } = {};
      if (minAmount) amountRange.min = Number(minAmount);
      if (maxAmount) amountRange.max = Number(maxAmount);
      filters.amountRange = amountRange;
    }

    const response = await TransactionService.getTransactions(Number(page), Number(limit), filters);

    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in getTransactions:', error);
    return res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

// Get transaction by ID
const getTransactionById = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const response = await TransactionService.getTransactionById(transactionId);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in getTransactionById:', error);
    return res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

// Update transaction (placeholder - not implemented as requested)
const updateTransaction = async (req: Request, res: Response) => {
  try {
    // This is a placeholder for update functionality
    /* The actual implementation is intentionally left out cuz im scared someone would want to hack us from updating payment and running away....
    lol....
    sha, whosoever would be doing this feature, Imagine as if someone is going to steal money from this website. Then build this feature in such a way that it wont be possbile */
    return res.status(501).json({
      message: 'Update transaction functionality not implemented yet',
      data: null,
      code: 501,
    });
  } catch (error) {
    console.error('Error in updateTransaction:', error);
    return res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

// Get transaction statistics
const getStatistics = async (req: Request, res: Response) => {
  try {
    const response = await TransactionService.getStatistics();
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in getStatistics:', error);
    return res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

// Process refund
const processRefund = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const { amount, reason } = req.body;
    const adminId = (req as any).userId; // Get from authenticated request

    if (!amount || !reason) {
      return res.status(400).json({
        message: 'Amount and reason are required',
        data: null,
        code: 400,
      });
    }

    const response = await TransactionService.processRefund(transactionId, Number(amount), reason, adminId);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in processRefund:', error);
    return res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

const Admin_TransactionController = {
  getTransactions,
  getTransactionById,
  updateTransaction,
  getStatistics,
  processRefund,
};

export default Admin_TransactionController;
