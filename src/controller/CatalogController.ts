import { Request, Response } from 'express';
import CatalogService from '@/services/catalog/catalogService';

const getCategoryTree = async (_req: Request, res: Response) => {
  try {
    const { message, data, code } = await CatalogService.getCategoryTree();
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCategoryTree:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getAddOns = async (req: Request, res: Response) => {
  try {
    const { message, data, code } = await CatalogService.getAddOns(String(req.params.productId));
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAddOns:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getSuggestions = async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
    const limit = req.query.limit ? Math.min(12, Math.max(1, parseInt(String(req.query.limit), 10) || 4)) : 4;
    const { message, data, code } = await CatalogService.getSuggestions(q, limit);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSuggestions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const CatalogController = { getCategoryTree, getAddOns, getSuggestions };
export default CatalogController;
