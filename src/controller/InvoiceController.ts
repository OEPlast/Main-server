import { Request, Response } from 'express';
import InvoiceService from '@/services/InvoiceService';
import { isAuthenticatedRequest } from '@/types';

const generateInvoiceForOrder = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const { orderId } = req.params;
    const result = await InvoiceService.getInvoiceData({ orderId, userId: req.userId });
    if (!result.data) return res.status(result.code).json({ message: result.message });
    return res.status(200).json({ message: 'Invoice data generated', data: result.data });
  } catch (error) {
    console.error('Error in generateInvoiceForOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const InvoiceController = { generateInvoiceForOrder };
export default InvoiceController;
