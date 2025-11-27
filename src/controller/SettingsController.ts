import { Request, Response } from 'express';
import SettingsService from '../services/SettingsService';

/**
 * Get store settings (public endpoint).
 */
const getSettings = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await SettingsService.getSettings();
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getSettings:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

/**
 * Update store settings (authenticated endpoint).
 */
const updateSettings = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await SettingsService.updateSettings(req.body);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in updateSettings:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const SettingsController = {
  getSettings,
  updateSettings,
};

export default SettingsController;
