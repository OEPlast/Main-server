import express from 'express';
import ShipmentController from '../../controller/admin/ShipmentController';
import ShipmentValidator from '../../validators/admin/ShipmentValidator';
import { isAuthenticated, isAdmin, requirePermission } from '../../middleware/auth';

const router = express.Router();

// All shipment routes require authentication and admin privileges
router.use(isAuthenticated, isAdmin);

// Shipment CRUD operations
router.post(
  '/',
  requirePermission('logistics', 'create'),
  ShipmentValidator.createShipmentValidator,
  ShipmentController.createShipment
);
router.get('/', requirePermission('logistics', 'read'), ShipmentController.getAllShipments);
router.get(
  '/:shipmentId',
  requirePermission('logistics', 'read'),
  ShipmentValidator.shipmentIdValidator,
  ShipmentController.getShipmentById
);
router.put(
  '/:shipmentId',
  requirePermission('logistics', 'update'),
  ShipmentValidator.updateShipmentValidator,
  ShipmentController.updateShipment
);
router.delete(
  '/:shipmentId',
  requirePermission('logistics', 'delete'),
  ShipmentValidator.shipmentIdValidator,
  ShipmentController.deleteShipment
);

// Shipment status and tracking
router.patch(
  '/:shipmentId/status',
  requirePermission('logistics', 'update'),
  ShipmentValidator.updateStatusValidator,
  ShipmentController.updateShipmentStatus
);
router.get(
  '/:shipmentId/tracking',
  requirePermission('logistics', 'read'),
  ShipmentValidator.shipmentIdValidator,
  ShipmentController.getShipmentTracking
);
router.post(
  '/:shipmentId/tracking',
  requirePermission('logistics', 'update'),
  ShipmentValidator.addTrackingValidator,
  ShipmentController.addTrackingUpdate
);

// Bulk operations
router.post(
  '/bulk/status',
  requirePermission('logistics', 'update'),
  ShipmentValidator.bulkUpdateValidator,
  ShipmentController.bulkUpdateStatus
);
router.get(
  '/filter/status/:status',
  requirePermission('logistics', 'read'),
  ShipmentValidator.statusFilterValidator,
  ShipmentController.getShipmentsByStatus
);

export default router;
