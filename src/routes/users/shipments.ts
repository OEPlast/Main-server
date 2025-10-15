import { Router } from 'express';
import { authenticateUser } from '@/middleware/auth';
import ShipmentController from '@/controller/ShipmentController';

const router = Router();

// User: Get shipment for an order
router.get('/orders/:orderId/shipment', authenticateUser, ShipmentController.getOrderShipment);

// User: List my shipments  
router.get('/shipments', authenticateUser, ShipmentController.getUserShipments);

// User: Get delivery status for an order
router.get('/orders/:orderId/delivery-status', authenticateUser, ShipmentController.getOrderDeliveryStatus);

// Public: Track shipment by tracking number (no authentication required)
router.get('/track/:trackingNumber', ShipmentController.trackShipment);

export default router;
