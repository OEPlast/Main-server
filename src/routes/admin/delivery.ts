import express from 'express';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';
import DeliveryController from '@/controller/admin/DeliveryController';
import DeliveryValidator from '@/validators/admin/DeliveryValidator';

const router = express.Router();

// Delivery routes are for admin users with delivery permissions (owners bypass)
router.use(authenticateUser, isAdmin);

router.get('/mine', requirePermission('delivery', 'read'), DeliveryValidator.listMineValidator, DeliveryController.listMine);
router.get('/mine/stats', requirePermission('delivery', 'read'), DeliveryController.statsMine);
router.get(
  '/:shipmentId',
  requirePermission('delivery', 'read'),
  DeliveryValidator.shipmentIdValidator,
  DeliveryController.getById
);
router.get(
  '/t/:tracking',
  requirePermission('delivery', 'read'),
  DeliveryValidator.shipmentByTrackingValidator,
  DeliveryController.getByTracking
);
router.patch(
  '/:shipmentId/status',
  requirePermission('delivery', 'update'),
  DeliveryValidator.updateStatusValidator,
  DeliveryController.updateStatus
);
router.post(
  '/:shipmentId/tracking',
  requirePermission('delivery', 'update'),
  DeliveryValidator.addTrackingValidator,
  DeliveryController.addTrackingUpdate
);
router.patch(
  '/:shipmentId/notes',
  requirePermission('delivery', 'update'),
  DeliveryValidator.updateNotesValidator,
  DeliveryController.updateNotes
);

export default router;
