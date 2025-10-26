import { Router } from 'express';
import SalesValidator from '@/validators/admin/SalesValidator';
import SalesController from '@/controller/admin/SalesController';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';

const router = Router();

// All admin sales routes require authentication and admin privileges
router.use(authenticateUser, isAdmin);

// CRUD for admin
router.post('/', requirePermission('sales', 'create'), SalesValidator.createSaleValidator, SalesController.createSale);
router.get('/all', requirePermission('sales', 'read'), SalesController.getAllSales);
router.get('/:id', requirePermission('sales', 'read'), SalesValidator.saleIdValidator, SalesController.getSaleById);
router.put(
  '/:id',
  requirePermission('sales', 'update'),
  SalesValidator.updateSaleValidator,
  SalesController.updateSale
);
router.delete('/:id', requirePermission('sales', 'delete'), SalesValidator.saleIdValidator, SalesController.deleteSale);

// Get by type
router.get(
  '/type/:type',
  requirePermission('sales', 'read'),
  SalesValidator.salesTypeValidator,
  SalesController.getSalesByType
);

// Usage analysis
router.get(
  '/:id/usage',
  requirePermission('sales', 'read'),
  SalesValidator.saleIdValidator,
  SalesController.getSaleUsage
);

// Decrement limit and mark inactive if needed
router.post(
  '/:id/decrement',
  requirePermission('sales', 'update'),
  SalesValidator.saleIdValidator,
  SalesController.decrementSaleLimit
);

export default router;
