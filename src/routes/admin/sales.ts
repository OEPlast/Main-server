import { Router } from 'express';
import {
  validateSalesCreate,
  validateSalesUpdate,
  validateSalesId,
  validateSalesType,
  validateSalesVariantUpdate,
} from '@/validators/admin/SalesValidator';
import SalesController from '@/controller/admin/SalesController';
import { isAuthenticated, isAdmin, requirePermission } from '@/middleware/auth';

const router = Router();

// All admin sales routes require authentication and admin privileges
router.use(isAuthenticated, isAdmin);

// CRUD for admin
router.post('/', requirePermission('sales', 'create'), validateSalesCreate, SalesController.createSale);
router.get('/', requirePermission('sales', 'read'), SalesController.getAllSales);
router.get('/:id', requirePermission('sales', 'read'), validateSalesId, SalesController.getSaleById);
router.put('/:id', requirePermission('sales', 'update'), validateSalesUpdate, SalesController.updateSale);
router.delete('/:id', requirePermission('sales', 'delete'), validateSalesId, SalesController.deleteSale);

// Get by type
router.get('/type/:type', requirePermission('sales', 'read'), validateSalesType, SalesController.getSalesByType);

// Variant mutation
router.patch(
  '/:id/variant',
  requirePermission('sales', 'update'),
  validateSalesVariantUpdate,
  SalesController.updateSaleVariant
);

// Usage analysis
router.get('/:id/usage', requirePermission('sales', 'read'), validateSalesId, SalesController.getSaleUsage);

// Decrement limit and mark inactive if needed
router.post(
  '/:id/decrement',
  requirePermission('sales', 'update'),
  validateSalesId,
  SalesController.decrementSaleLimit
);

export default router;
