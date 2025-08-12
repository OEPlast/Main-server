import { Request, Response } from 'express';
import InventoryService from '@/services/inventoryService';

export const getAvailability = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const result = await InventoryService.getAvailability(productId);
  res.status(result.code).json(result);
};

export const adjustStock = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { delta } = req.body as { delta: number };
  const result = await InventoryService.adjustStock(productId, delta);
  res.status(result.code).json(result);
};

export const validateReservation = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { quantity } = req.body as { quantity: number };
  const result = await InventoryService.validateReservation(productId, quantity);
  res.status(result.code).json(result);
};

export default { getAvailability, adjustStock, validateReservation };
