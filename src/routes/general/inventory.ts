import { Router, Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { productIdParam, adjustStockValidator, reserveValidator } from '@/validators/inventoryValidator';
import InventoryController from '@/controller/inventoryController';
import { isAuthenticated, isAdmin } from '@/middleware/auth';

const router = Router();

const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', data: errors.array(), code: 400 });
  }
  next();
};

// Public availability
router.get('/:productId/availability', productIdParam, validate, InventoryController.getAvailability);

// Admin stock adjust
router.post(
  '/:productId/stock',
  isAuthenticated,
  isAdmin,
  adjustStockValidator,
  validate,
  InventoryController.adjustStock
);

// Reservation validation (pre-checkout)
router.post(
  '/:productId/reserve',
  isAuthenticated,
  reserveValidator,
  validate,
  InventoryController.validateReservation
);

export default router;
