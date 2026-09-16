import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import SettingsService from '../services/SettingsService';

/** Tax registration details are for staff; the storefront reads this endpoint too. */
const STAFF_ONLY_FIELDS = ['taxId', 'taxRate'] as const;

/**
 * Get store settings (public endpoint).
 */
const getSettings = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await SettingsService.getSettings();
    // Public route: the tax registration id and rate are for staff only.
    const isStaff = ['owner', 'manager', 'employee'].includes((req as AuthenticatedRequest).role ?? '');
    if (data && !isStaff) {
      const raw =
        (data as unknown as { toObject?: () => Record<string, unknown> }).toObject?.() ??
        (data as unknown as Record<string, unknown>);
      const publicSettings = { ...raw };
      for (const field of STAFF_ONLY_FIELDS) delete publicSettings[field];
      return res.status(code).json({ data: publicSettings, message });
    }
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
