import { Request, Response } from 'express';
import InvoiceService from '@/services/InvoiceService';

const generateForOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const result = await InvoiceService.getInvoiceData(orderId);
    if (!result.data) return res.status(result.code).json({ message: result.message });
    return res.status(200).json({ message: 'Invoice data generated', data: result.data });
  } catch (error) {
    console.error('Error in generateForOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const InvoiceController = { generateForOrder };
export default InvoiceController;
