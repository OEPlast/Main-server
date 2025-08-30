import { Request, Response } from 'express';
import TransactionService from '../services/TransactionService';
import { isAuthenticatedRequest } from '@/types';

/**
 * Initialize payment
 */
const initializePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedRequest(req)) {
      res.status(401).json({
        message: 'Authentication required',
        data: null,
        code: 401,
      });
      return;
    }

    const { orderId, email, amount, currency, metadata } = req.body;
    const userId = req.userId;

    const result = await TransactionService.initializePayment({
      orderId,
      userId,
      email,
      amount,
      currency,
      metadata,
    });

    res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in initializePayment controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Verify payment
 */
const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reference } = req.params;

    const result = await TransactionService.verifyPayment(reference);
    res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in verifyPayment controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Handle Paystack webhook
 */
const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      res.status(400).json({
        message: 'Missing signature',
        data: null,
        code: 400,
      });
      return;
    }

    // rawBody is attached by express.json verify hook in server.ts
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ message: 'Missing raw body', data: null, code: 400 });
      return;
    }

    const result = await TransactionService.handleWebhook(rawBody, signature);
    res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in handleWebhook controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Get transaction by ID
 */
const getTransactionById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedRequest(req)) {
      res.status(401).json({
        message: 'Authentication required',
        data: null,
        code: 401,
      });
      return;
    }

    const { transactionId } = req.params;

    const result = await TransactionService.getPaymentById(transactionId);
    res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in getTransactionById controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Get user transactions
 */
const getUserTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedRequest(req)) {
      res.status(401).json({
        message: 'Authentication required',
        data: null,
        code: 401,
      });
      return;
    }

    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await TransactionService.getUserPayments(userId, page, limit);
    res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in getUserTransactions controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Get payment by reference
 */
const getPaymentByReference = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedRequest(req)) {
      res.status(401).json({
        message: 'Authentication required',
        data: null,
        code: 401,
      });
      return;
    }

    const { reference } = req.params;

    const result = await TransactionService.getPaymentByReference(reference);
    res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in getPaymentByReference controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Refund payment (Admin only)
 */
const refundPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedRequest(req)) {
      res.status(401).json({
        message: 'Authentication required',
        data: null,
        code: 401,
      });
      return;
    }

    // Add admin role check here if needed
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const result = await TransactionService.refundPayment(paymentId, { amount, reason });
    res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in refundPayment controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

const TransactionController = {
  initializePayment,
  verifyPayment,
  handleWebhook,
  getTransactionById,
  getUserTransactions,
  getPaymentByReference,
  refundPayment,
};

export default TransactionController;
