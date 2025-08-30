import { Request, Response } from 'express';
import AdminInventoryService from '@/services/admin/InventoryService';

const list = async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const q = (req.query.q as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const lowOnly = (req.query.lowOnly as string) === 'true' ? true : undefined;

    const result = await AdminInventoryService.list(page, limit, { q, status, lowOnly });
    res.status(result.code).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Inventory list failed', data: null, code: 500 });
  }
};

const setLowStockThreshold = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { threshold } = req.body as { threshold: number };
    const result = await AdminInventoryService.setLowStockThreshold(productId, threshold);
    res.status(result.code).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update threshold', data: null, code: 500 });
  }
};

const setStock = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { stock, variants } = req.body as {
      stock?: number;
      variants?: Array<{ attributeName: string; childName: string; stock: number }>;
    };
    const result = await AdminInventoryService.setStock(productId, { stock, variants });
    res.status(result.code).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update stock', data: null, code: 500 });
  }
};

export default { list, setLowStockThreshold, setStock };
