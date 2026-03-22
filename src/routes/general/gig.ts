import { Router } from 'express';
import GIGController from '@/controller/GIGController';
import { authenticateUser } from '@/middleware/auth';

const router = Router();

// Calculate shipping requires authentication (to prevent abuse)
router.post('/calculate-shipping', authenticateUser, GIGController.calculateShipping);

// Public: get stations list
router.get('/stations', GIGController.getStations);

// Public: checkout delivery settings
router.get('/config', GIGController.getCheckoutConfig);

// Public: track shipment
router.get('/track/:waybill', GIGController.trackShipment);

export default router;
