import { Router, Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';
import AdminInventoryController from '@/controller/admin/InventoryController';
import { listValidator, setThresholdValidator, setStockValidator } from '@/validators/admin/inventoryValidator';

const router = Router();

const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', data: errors.array(), code: 400 });
  }
  next();
};

// List inventory requires read permission on inventory
router.get(
  '/',
  authenticateUser,
  isAdmin,
  requirePermission('inventory', 'read'),
  listValidator,
  validate,
  AdminInventoryController.list
);

// Set low stock threshold requires update permission on inventory
router.patch(
  '/:productId/threshold',
  authenticateUser,
  isAdmin,
  requirePermission('inventory', 'update'),
  setThresholdValidator,
  validate,
  AdminInventoryController.setLowStockThreshold
);

// Set stock requires update permission on inventory
router.patch(
  '/:productId/stock',
  authenticateUser,
  isAdmin,
  requirePermission('inventory', 'update'),
  setStockValidator,
  validate,
  AdminInventoryController.setStock
);

export default router;
