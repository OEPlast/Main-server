import { Router } from 'express';
import {
  validateSalesCreate,
  validateSalesUpdate,
  validateSalesId,
  validateSalesType,
  validateSalesVariantUpdate,
} from '@/validators/admin/SalesValidator';
import SalesController from '@/controller/admin/SalesController';

const router = Router();

// CRUD for admin
router.post('/', validateSalesCreate, SalesController.createSale);
router.get('/', SalesController.getAllSales);
router.get('/:id', validateSalesId, SalesController.getSaleById);
router.put('/:id', validateSalesUpdate, SalesController.updateSale);
router.delete('/:id', validateSalesId, SalesController.deleteSale);

// Get by type
router.get('/type/:type', validateSalesType, SalesController.getSalesByType);

// Variant mutation
router.patch('/:id/variant', validateSalesVariantUpdate, SalesController.updateSaleVariant);

// Usage analysis
router.get('/:id/usage', validateSalesId, SalesController.getSaleUsage);

// Decrement limit and mark inactive if needed
router.post('/:id/decrement', validateSalesId, SalesController.decrementSaleLimit);

export default router;
