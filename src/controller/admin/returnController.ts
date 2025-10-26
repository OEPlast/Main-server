import { Request, Response } from 'express';
import returnService from '../../services/returnService';
import ReturnTransactionService from '../../services/returnTransactionService';

/**
 * Get all returns with filtering and pagination
 * GET /admin/returns
 */
const getAllReturns = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      userId,
      orderId,
      startDate,
      endDate,
      search,
    } = req.query;

    const filters: Record<string, unknown> = {};

    if (status) filters.status = status;
    if (userId) filters.userId = userId;
    if (orderId) filters.orderId = orderId;
    if (search) filters.search = search;

    if (startDate && endDate) {
      filters.dateRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string),
      };
    }

    const response = await returnService.getReturns({
      page: Number(page),
      limit: Number(limit),
      ...filters,
    });

    res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in getAllReturns controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Get return by ID
 * GET /admin/returns/:id
 */
const getReturnById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const response = await returnService.getReturnById(id);

    res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in getReturnById controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Update return status
 * PATCH /admin/returns/:id/status
 */
const updateReturnStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const adminId = (req as any).userId; // From auth middleware

    if (!status) {
      return res.status(400).json({
        message: 'Status is required',
        data: null,
        code: 400,
      });
    }

    const response = await returnService.updateReturnStatus(id, {
      status,
      adminNotes,
    });

    res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in updateReturnStatus controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Process refund for a return
 * POST /admin/returns/:id/refund
 */
const processRefund = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { refundAmount, refundMethod, adminNotes } = req.body;

    if (!refundAmount || !refundMethod) {
      return res.status(400).json({
        message: 'Refund amount and method are required',
        data: null,
        code: 400,
      });
    }

    // Get return details
    const returnResponse = await returnService.getReturnById(id);
    if (returnResponse.code !== 200 || !returnResponse.data) {
      return res.status(returnResponse.code).json(returnResponse);
    }

    const returnData = returnResponse.data;

    // Check if return is in a refundable state
    // Refund can only be processed after return is approved (which comes after inspection)
    const refundableStatuses = ['approved'];
    if (!refundableStatuses.includes(returnData.status)) {
      return res.status(400).json({
        message: `Return must be approved before refund can be processed. Current status: ${returnData.status}`,
        data: null,
        code: 400,
      });
    }

    // Check if already refunded
    if (returnData.refundTransaction) {
      return res.status(400).json({
        message: 'Refund already processed for this return',
        data: null,
        code: 400,
      });
    }

    // Create return transaction
    const transactionResponse = await ReturnTransactionService.createReturnTransaction({
      returnId: id,
      userId: returnData.user._id.toString(), // user is populated, need _id
      amount: refundAmount,
      refundMethod,
      customerInfo: {
        email: returnData.user.email || 'customer@example.com',
        name: `${returnData.user.firstName || ''} ${returnData.user.lastName || ''}`.trim() || 'Customer',
        phone: returnData.user.phoneNumber,
      },
    });

    if (transactionResponse.code !== 201 || !transactionResponse.data) {
      return res.status(transactionResponse.code).json(transactionResponse);
    }

    // Update return status to completed
    const updateResponse = await returnService.updateReturnStatus(id, {
      status: 'completed',
      adminNotes: adminNotes || 'Refund processed successfully',
    });

    if (updateResponse.code !== 200) {
      return res.status(updateResponse.code).json(updateResponse);
    }

    // Note: Order totalReturned tracking would need to be added to Order model
    // For now, we're skipping that until Order model is updated

    res.status(200).json({
      message: 'Refund processed successfully',
      data: {
        return: updateResponse.data,
        transaction: transactionResponse.data,
      },
      code: 200,
    });
  } catch (error) {
    console.error('Error in processRefund controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Delete return
 * DELETE /admin/returns/:id
 */
const deleteReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const response = await returnService.deleteReturn(id);

    res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in deleteReturn controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

/**
 * Get return statistics
 * GET /admin/returns/statistics
 */
const getReturnStatistics = async (req: Request, res: Response) => {
  try {
    const response = await returnService.getReturnsStatistics();

    res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in getReturnStatistics controller:', error);
    res.status(500).json({
      message: 'Internal server error',
      data: null,
      code: 500,
    });
  }
};

const adminReturnController = {
  getAllReturns,
  getReturnById,
  updateReturnStatus,
  processRefund,
  deleteReturn,
  getReturnStatistics,
};

export default adminReturnController;
