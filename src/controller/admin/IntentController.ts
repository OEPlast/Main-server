import { Request, Response } from 'express';
import IntentService from '../../services/admin/IntentService';

const createIntent = async (req: Request, res: Response) => {
  try {
    const result = await IntentService.createIntent(req.body);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in createIntent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllIntents = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const result = await IntentService.getAllIntents(status as string | undefined);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getAllIntents:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getIntentById = async (req: Request, res: Response) => {
  try {
    const { intentId } = req.params;
    const result = await IntentService.getIntentById(intentId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getIntentById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateIntent = async (req: Request, res: Response) => {
  try {
    const { intentId } = req.params;
    const result = await IntentService.updateIntent(intentId, req.body);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in updateIntent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteIntent = async (req: Request, res: Response) => {
  try {
    const { intentId } = req.params;
    const result = await IntentService.deleteIntent(intentId);
    return res.status(result.code).json({ message: result.message });
  } catch (error) {
    console.error('Error in deleteIntent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const toggleIntentStatus = async (req: Request, res: Response) => {
  try {
    const { intentId } = req.params;
    const { status } = req.body;
    const result = await IntentService.toggleIntentStatus(intentId, status);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in toggleIntentStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const checkSlug = async (req: Request, res: Response) => {
  try {
    const { slug, excludeId } = req.query;
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ message: 'slug query param is required', data: null });
    }
    const result = await IntentService.checkSlugAvailability(slug, excludeId as string | undefined);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in checkSlug:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createIntent,
  getAllIntents,
  getIntentById,
  updateIntent,
  deleteIntent,
  toggleIntentStatus,
  checkSlug,
};
