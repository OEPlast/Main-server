import express from 'express';
import VyluxController from '@/controller/admin/VyluxController';
import VyluxValidator from '@/validators/admin/VyluxValidator';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';

const router = express.Router();

// Every route answers 503 unless VYLUX_API_URL and VYLUX_API_KEY are set.
router.use(authenticateUser, isAdmin);

/**
 * @route GET /admin/vylux/status
 * @desc  Whether this deployment can import from the Vylux scraper
 */
router.get('/status', requirePermission('products', 'read'), VyluxController.getStatus);

/**
 * @route GET /admin/vylux/products?after=&limit=
 * @desc  Accepted scraper products not yet imported, with their media and Vylux price lines
 */
router.get(
  '/products',
  requirePermission('products', 'read'),
  ...VyluxValidator.listValidator,
  VyluxController.listProducts
);

/**
 * @route POST /admin/vylux/import
 * @desc  Import up to 10 products as inactive drafts: { items: [{ vyluxId, categoryId, price, name?, description? }] }
 */
router.post(
  '/import',
  requirePermission('products', 'create'),
  ...VyluxValidator.importValidator,
  VyluxController.importProducts
);

export default router;
