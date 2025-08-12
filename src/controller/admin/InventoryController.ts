import { Request, Response } from 'express';
import AdminInventoryService from '@/services/admin/InventoryService';

const list = async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '20', 10);
  const q = (req.query.q as string) || undefined;
  const status = (req.query.status as string) || undefined;
  const lowOnly = (req.query.lowOnly as string) === 'true' ? true : undefined;

  const result = await AdminInventoryService.list(page, limit, { q, status, lowOnly });
  res.status(result.code).json(result);
};

const setLowStockThreshold = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { threshold } = req.body as { threshold: number };
  const result = await AdminInventoryService.setLowStockThreshold(productId, threshold);
  res.status(result.code).json(result);
};

const setStock = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { stock } = req.body as { stock: number };
  const result = await AdminInventoryService.setStock(productId, stock);
  res.status(result.code).json(result);
};

const bulkAdjustStock = async (req: Request, res: Response) => {
  const updates = req.body as Array<{ productId: string; delta: number }>;
  const result = await AdminInventoryService.bulkAdjustStock(updates);
  res.status(result.code).json(result);
};

export default { list, setLowStockThreshold, setStock, bulkAdjustStock };
