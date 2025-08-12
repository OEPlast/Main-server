import { Request, Response } from 'express';
import * as SalesService from '@/services/admin/SalesService';

const SalesController = {
  async createSale(req: Request, res: Response) {
    try {
      const sale = await SalesService.createSale(req.body);
      res.status(201).json(sale);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(400).json({ error });
    }
  },
  async getAllSales(req: Request, res: Response) {
    try {
      const sales = await SalesService.getAllSales();
      res.json(sales);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(500).json({ error });
    }
  },
  async getSaleById(req: Request, res: Response) {
    try {
      const sale = await SalesService.getSaleById(req.params.id);
      if (!sale) return res.status(404).json({ error: 'Sale not found' });
      res.json(sale);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(400).json({ error });
    }
  },
  async updateSale(req: Request, res: Response) {
    try {
      const sale = await SalesService.updateSale(req.params.id, req.body);
      if (!sale) return res.status(404).json({ error: 'Sale not found' });
      res.json(sale);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(500).json({ error });
    }
  },
  async deleteSale(req: Request, res: Response) {
    try {
      const sale = await SalesService.deleteSale(req.params.id);
      if (!sale) return res.status(404).json({ error: 'Sale not found' });
      res.json({ message: 'Sale deleted' });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(500).json({ error });
    }
  },
  async getSalesByType(req: Request, res: Response) {
    try {
      const sales = await SalesService.getSalesByType(req.params.type);
      res.json(sales);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(500).json({ error });
    }
  },
  async updateSaleVariant(req: Request, res: Response) {
    try {
      const { variantIndex, variantData } = req.body;
      const sale = await SalesService.updateSaleVariant(req.params.id, variantIndex, variantData);
      if (!sale) return res.status(404).json({ error: 'Sale or variant not found' });
      res.json(sale);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(400).json({ error });
    }
  },
  async getSaleUsage(req: Request, res: Response) {
    try {
      const usage = await SalesService.getSaleUsage(req.params.id);
      res.json(usage);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(400).json({ error });
    }
  },
  async decrementSaleLimit(req: Request, res: Response) {
    try {
      const { variantIndex } = req.body;
      const sale = await SalesService.decrementSaleLimit(req.params.id, variantIndex);
      res.json(sale);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      res.status(400).json({ error });
    }
  },
};

export default SalesController;
