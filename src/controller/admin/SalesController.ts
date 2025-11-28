import { Request, Response } from 'express';
import * as SalesService from '@/services/admin/SalesService';
import { isAuthenticatedRequest } from '@/types';

const SalesController = {
  async createSale(req: Request, res: Response) {
    try {
      if (!isAuthenticatedRequest(req)) {
        return res.status(500).json({ error: 'Unauthorized' });
      }
      const { code, data, message } = await SalesService.createSale(req.body, req.userId);
      return res.status(code).json({ message, data });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      return res.status(500).json({ error });
    }
  },
  async getAllSales(req: Request, res: Response) {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const { code, data, message, meta } = await SalesService.getAllSales(page, limit);
      return res.status(code).json({ message, data, meta });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      return res.status(500).json({ error });
    }
  },
  async getSaleById(req: Request, res: Response) {
    try {
      const { code, data, message } = await SalesService.getSaleById(req.params.id);
      return res.status(code).json({ message, data });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      return res.status(500).json({ error });
    }
  },
  async updateSale(req: Request, res: Response) {
    try {
      if (!isAuthenticatedRequest(req)) {
        return res.status(500).json({ error: 'Unauthorized' });
      }
      const { code, data, message } = await SalesService.updateSale(req.params.id, req.body, req.userId);
      return res.status(code).json({ message, data });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      return res.status(500).json({ error });
    }
  },
  async deleteSale(req: Request, res: Response) {
    try {
      const { data, message, code } = await SalesService.deleteSale(req.params.id);
      return res.status(code).json({ message, data });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      return res.status(500).json({ error });
    }
  },
  async getSalesByType(req: Request, res: Response) {
    try {
      const { code, data, message } = await SalesService.getSalesByType(req.params.type);
      return res.status(code).json({ message, data });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      return res.status(500).json({ error });
    }
  },
  async getSaleUsage(req: Request, res: Response) {
    try {
      const usage = await SalesService.getSaleUsage(req.params.id);
      res.json(usage);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      return res.status(500).json({ error });
    }
  },
  async decrementSaleLimit(req: Request, res: Response) {
    try {
      const { variantIndex } = req.body;
      const sale = await SalesService.decrementSaleLimit(req.params.id, variantIndex);
      res.json(sale);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      return res.status(500).json({ error });
    }
  },
};

export default SalesController;
