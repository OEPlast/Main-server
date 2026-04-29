import { Router } from 'express';
import AdminGIGController from '@/controller/admin/GIGController';
import { authenticateUser, isAdmin } from '@/middleware/auth';

const router = Router();

router.use(authenticateUser, isAdmin);

// GIG Configuration (singleton)
router.get('/config', AdminGIGController.getConfig);
router.put('/config', AdminGIGController.updateConfig);

// GIG Stations (proxy)
router.get('/stations', AdminGIGController.getStations);

// GIG Tracking (proxy)
router.get('/track/:waybill', AdminGIGController.trackShipment);

// GIG Shipments list and detail
router.get('/shipments', AdminGIGController.listGIGShipments);
router.get('/shipments/:waybill', AdminGIGController.getGIGShipmentInfo);

export default router;
