import express from 'express';
import { getSettings, createSettings, updateSettings, deleteSettings } from '../../controller/settingsController';

const router = express.Router();

router.get('/settings', getSettings);
router.post('/settings', createSettings);
router.put('/settings/:id', updateSettings);
router.delete('/settings/:id', deleteSettings);

export default router;
