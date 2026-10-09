import { Request, Response } from 'express';
import VyluxService, { VyluxImportItem } from '@/services/vylux/VyluxService';

const getStatus = (_req: Request, res: Response) => {
  return res.status(200).json({ message: 'Vylux import status', data: { configured: VyluxService.isConfigured() } });
};

const listProducts = async (req: Request, res: Response) => {
  try {
    const after = req.query.after != null ? Number(req.query.after) : undefined;
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    const { message, data, code } = await VyluxService.listProducts({ after, limit });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in Vylux listProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const importProducts = async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: VyluxImportItem[] };
    const { message, data, code } = await VyluxService.importProducts(items);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in Vylux importProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const prepareProduct = async (req: Request, res: Response) => {
  try {
    const { message, data, code } = await VyluxService.prepareProduct(Number(req.params.vyluxId));
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in Vylux prepareProduct:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const VyluxController = { getStatus, listProducts, importProducts, prepareProduct };
export default VyluxController;
