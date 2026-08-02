import { Request, Response } from 'express';
import PublicIntentService from '../services/IntentService';

/**
 * Public intent-shop endpoints consumed by the storefront.
 * Only `active` intents are exposed — see services/IntentService.ts.
 */

const getActiveIntents = async (_req: Request, res: Response) => {
  try {
    const result = await PublicIntentService.getActiveIntents();
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getActiveIntents:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getActiveIntentSlugs = async (_req: Request, res: Response) => {
  try {
    const result = await PublicIntentService.getActiveIntentSlugs();
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getActiveIntentSlugs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getIntentBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await PublicIntentService.getIntentBySlug(slug);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getIntentBySlug:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getActiveIntents,
  getActiveIntentSlugs,
  getIntentBySlug,
};
