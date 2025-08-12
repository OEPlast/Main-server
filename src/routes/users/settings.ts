import express from 'express';
import { getSettings, createSettings, updateSettings, deleteSettings } from '../../controller/settingsController';
import UserValidator from '../../validators/UserValidator';
import { isAuthenticated } from '../../middleware/auth';

const router = express.Router();

// All settings routes require authentication
router.use(isAuthenticated);

router.get('/', getSettings);
router.post('/', ...UserValidator.validateStoreSettings, createSettings);
router.put('/:id', ...UserValidator.validateStoreSettings, updateSettings);
router.delete('/:id', deleteSettings);

export default router;
