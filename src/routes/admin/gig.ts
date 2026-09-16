import { Router } from 'express';
import AdminGIGController from '@/controller/admin/GIGController';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';

const router = Router();

router.use(authenticateUser, isAdmin);

// GIG Configuration (singleton)
router.get('/config', requirePermission('logistics', 'read'), AdminGIGController.getConfig);
router.put('/config', requirePermission('logistics', 'update'), AdminGIGController.updateConfig);

// GIG Stations (proxy)
router.get('/stations', requirePermission('logistics', 'read'), AdminGIGController.getStations);

// GIG Tracking (proxy)
router.get('/track/:waybill', requirePermission('delivery', 'read'), AdminGIGController.trackShipment);

// GIG Shipments list and detail
router.get('/shipments', requirePermission('delivery', 'read'), AdminGIGController.listGIGShipments);
router.get('/shipments/:waybill', requirePermission('delivery', 'read'), AdminGIGController.getGIGShipmentInfo);

export default router;
