import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import returnService from '../services/returnService';

/**
 * Customer Return Controller
 * Handles customer-facing return operations
 */

/**
 * Initiate a new return request
 * POST /returns
 */
export const initiateReturn = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const { orderId, items, type = 'refund', customerNotes } = req.body;

    const returnData = {
      orderId,
      userId,
      items,
      type,
      customerNotes,
    };

    const { data, message, code } = await returnService.initiateReturn(returnData);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in initiateReturn:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      code: 500 
    });
  }
};

/**
 * Get all returns for authenticated user
 * GET /returns
 */
export const getMyReturns = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const { page = 1, limit = 10, status } = req.query;

    const searchParams = {
      userId,
      status: status as string,
      page: Number(page),
      limit: Number(limit),
    };

    const { data, meta, message, code } = await returnService.getReturns(searchParams);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getMyReturns:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      code: 500 
    });
  }
};

/**
 * Get specific return by ID (must belong to user)
 * GET /returns/:id
 */
export const getReturnById = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const { id } = req.params;

    const { data, message, code } = await returnService.getReturnById(id);

    // Ensure return belongs to user (authorization check)
    if (data && data.user.toString() !== userId) {
      return res.status(403).json({ 
        message: 'Access denied: This return does not belong to you',
        data: null,
        code: 403 
      });
    }

    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReturnById:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      code: 500 
    });
  }
};

/**
 * Cancel a return request (only if status is pending)
 * POST /returns/:id/cancel
 */
export const cancelReturn = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const { id } = req.params;

    // First verify the return belongs to user
    const { data: returnData, code: fetchCode } = await returnService.getReturnById(id);
    
    if (!returnData) {
      return res.status(fetchCode).json({ 
        message: 'Return not found',
        data: null,
        code: fetchCode 
      });
    }

    if (returnData.user.toString() !== userId) {
      return res.status(403).json({ 
        message: 'Access denied: This return does not belong to you',
        data: null,
        code: 403 
      });
    }

    // Check if return can be cancelled (only pending returns)
    if (returnData.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Only pending returns can be cancelled',
        data: null,
        code: 400 
      });
    }

    const { data, message, code } = await returnService.cancelReturn(id, userId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in cancelReturn:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      code: 500 
    });
  }
};

const ReturnController = {
  initiateReturn,
  getMyReturns,
  getReturnById,
  cancelReturn,
};

export default ReturnController;
