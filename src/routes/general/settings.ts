import express from 'express';
import SettingsController from '../../controller/SettingsController';
import SettingsValidator from '../../validators/SettingsValidator';
import { authenticateUser, requirePermission } from '@/middleware/auth';
import { getBrand } from '@/services/email/brand';

const router = express.Router();

// Public route - Get store settings (everyone has read access)
router.get('/', SettingsController.getSettings);

/**
 * GET /settings/branding
 *
 * Public, resolved brand values (Settings → env → fallback, same chain email uses via
 * getBrand()) for storefront/admin to render the store name, logo, etc. without each
 * reimplementing the fallback chain themselves.
 */
router.get('/branding', async (_req, res) => {
  try {
    const brand = await getBrand();
    return res.status(200).json({ data: brand });
  } catch (error) {
    console.error('Error fetching branding:', error);
    return res.status(500).json({ error: 'Failed to resolve branding' });
  }
});

// Protected route - Update store settings (requires settings:update permission)
router.put(
  '/',
  authenticateUser,
  requirePermission('settings', 'update'),
  SettingsValidator.validateUpdateSettings,
  SettingsController.updateSettings
);

export default router;
