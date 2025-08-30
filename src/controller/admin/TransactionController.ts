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
      paymentGateway,
      userId,
      orderId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      reference,
      transactionId, // This is now gateway transaction ID from query
    } = req.query;

    const filters: Record<string, unknown> = {};
    
    if (status) filters.status = status;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (paymentGateway) filters.paymentGateway = paymentGateway;
    if (userId) filters.userId = userId;
    if (orderId) filters.orderId = orderId;
    if (reference) filters.reference = reference;
    if (transactionId) filters.gatewayTransactionId = transactionId; // Map to gatewayTransactionId
    
    if (startDate && endDate) {
      filters.dateRange = { 
        start: new Date(startDate as string), 
        end: new Date(endDate as string) 
      };
    }
    
    if (minAmount || maxAmount) {
      const amountRange: { min?: number; max?: number } = {};
      if (minAmount) amountRange.min = Number(minAmount);
      if (maxAmount) amountRange.max = Number(maxAmount);
      filters.amountRange = amountRange;
    }

    const response = await TransactionService.getTransactions(
      Number(page),
      Number(limit),
      filters
    );

    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in getTransactions:', error);
    return res.status(500).json({ 
      message: 'Internal server error', 
      data: null, 
      code: 500 
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
      code: 500 
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
      code: 500 
    });
  }
};

const Admin_TransactionController = {
  getTransactions,
  getTransactionById,
  updateTransaction,
};

export default Admin_TransactionController;
