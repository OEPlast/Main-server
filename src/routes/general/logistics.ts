import { Router } from 'express';
import LogisticsController from '@/controller/LogisticsController';

const router = Router();

// Public: Track shipment by tracking number
router.get('/track/:trackingNumber', LogisticsController.trackOrder);

export default router;
