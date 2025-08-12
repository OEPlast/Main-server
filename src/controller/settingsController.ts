import { Request, Response } from 'express';
import SettingsService from '@/services/SettingsService';
import { SettingsType } from '@/models/Settings';

// Get settings
const getSettings = async (req: Request, res: Response) => {
  try {
    const result = await SettingsService.getSettings();
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getSettings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Create settings (or update if exists)
const createSettings = async (req: Request, res: Response) => {
  try {
    const payload: Partial<SettingsType> = req.body;
    const result = await SettingsService.upsertSettings(payload);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in createSettings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update settings
const updateSettings = async (req: Request, res: Response) => {
  try {
    const payload: Partial<SettingsType> = req.body;
    const result = await SettingsService.upsertSettings(payload);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in updateSettings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete settings (soft delete by clearing fields)
const deleteSettings = async (req: Request, res: Response) => {
  try {
    const cleared: Partial<SettingsType> = {
      storeName: '',
      companyName: '',
      logoUrl: '',
      websiteUrl: '',
      supportEmail: '',
      supportPhone: '',
      address: { line1: '', line2: '', city: '', state: '', zip: '', country: '' } as SettingsType['address'],
      taxId: '',
    };
    const result = await SettingsService.upsertSettings(cleared);
    return res.status(result.code).json({ message: 'Settings cleared', data: result.data });
  } catch (error) {
    console.error('Error in deleteSettings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export { getSettings, createSettings, updateSettings, deleteSettings };
