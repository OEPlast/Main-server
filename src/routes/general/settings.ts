import express from 'express';
import SettingsController from '../../controller/SettingsController';
import SettingsValidator from '../../validators/SettingsValidator';
import { authenticateUser, requirePermission } from '@/middleware/auth';

const router = express.Router();

// Public route - Get store settings (everyone has read access)
router.get('/', SettingsController.getSettings);

// Protected route - Update store settings (requires settings:update permission)
router.put(
  '/',
  authenticateUser,
  requirePermission('settings', 'update'),
  SettingsValidator.validateUpdateSettings,
  SettingsController.updateSettings
);

export default router;
