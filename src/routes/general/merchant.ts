import { Router, Request, Response, NextFunction } from 'express';
import MerchantApiController from '../../controller/MerchantApiController';

const router = Router();

/**
 * Shared-secret guard. These endpoints trigger writes to Google Merchant Center
 * and expose account data, so they must not be public. Set MERCHANT_SYNC_KEY and
 * send it as `x-merchant-key`. If the key is unset, the routes are disabled.
 */
function requireMerchantKey(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.MERCHANT_SYNC_KEY;
  if (!configured) {
    return res.status(503).json({ success: false, message: 'MERCHANT_SYNC_KEY not set' });
  }
  if (req.header('x-merchant-key') !== configured) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

router.use(requireMerchantKey);

// Add / manage + frequent updates
router.post('/sync', MerchantApiController.syncAll);
router.post('/products/:productId', MerchantApiController.upsertOne);
router.delete('/products/:offerId', MerchantApiController.deleteOne);

// Monitoring
router.get('/issues', MerchantApiController.issues);
router.get('/datasource-status', MerchantApiController.dataSourceStatus);

export default router;
