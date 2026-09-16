import { Router, Request, Response } from 'express';
import Order from '@/models/Order';
import { verifyInternalService } from '@/middleware/auth';
import { logger } from '@/lib/logger';
import { getBrand } from '@/services/brand';
import { isMarketingAllowed } from '@/services/email/consent';
import { signUnsubscribeToken } from '@/utils/unsubscribeToken';
import mongoose from 'mongoose';
import { reconcileOrderPayment } from '@/services/payments/paymentOutcome';
import { paymentMaxWaitMs } from '@/cron/paymentReconciliation';
const router = Router();

// Apply internal service authentication to all routes
router.use(verifyInternalService);

/**
 * GET /api/internal/orders/pending-payments
 * Fetches orders with isPaid=false and status=Pending created within the last 30 minutes
 * Used for timeout recovery on event-bus restart
 */
router.get('/orders/pending-payments', async (req: Request, res: Response) => {
  try {
    // Calculate cutoff time (30 minutes ago)
    const CART_RESTORATION_TIMEFRAME = parseInt(process.env.CART_RESTORATION_TIMEFRAME || '1800000');
    const cutoffTime = new Date(Date.now() - CART_RESTORATION_TIMEFRAME);

    const pendingOrders = await Order.find({
      isPaid: false,
      status: 'Pending',
      createdAt: { $gte: cutoffTime }, // Only orders created within timeframe
    })
      .select('_id createdAt')
      .lean();

    const formattedOrders = pendingOrders.map((order) => ({
      _id: order._id.toString(),
      createdAt: order.createdAt,
    }));

    logger.info(`Fetched ${formattedOrders.length} pending orders created after ${cutoffTime.toISOString()}`);

    return res.status(200).json({
      message: 'Pending orders fetched successfully',
      orders: formattedOrders,
    });
  } catch (error) {
    logger.error('Error fetching pending orders:', error);
    return res.status(500).json({
      message: 'Failed to fetch pending orders',
      code: 'FETCH_FAILED',
    });
  }
});

/**
 * POST /api/internal/orders/verify-and-restore-stock
 *
 * Settles an unpaid order whose payment window has passed. Kept for event-bus deployments that
 * still run the old payment timer; the reconciliation job (cron/paymentReconciliation) is what does
 * this now. Both go through reconcileOrderPayment, which releases stock at most once and never
 * cancels an order Paystack still reports as being paid.
 */
router.post('/orders/verify-and-restore-stock', async (req: Request, res: Response) => {
  const { orderId } = req.body;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ message: 'Missing or invalid orderId', code: 'INVALID_REQUEST' });
  }

  const result = await reconcileOrderPayment(orderId, { maxWaitMs: paymentMaxWaitMs() });
  const restored = result === 'failed' || result === 'expired';
  return res.status(result === 'error' ? 500 : 200).json({
    message: `Reconciliation result: ${result}`,
    code: result.toUpperCase(),
    restored,
    action: restored ? 'stock_restored' : result === 'paid' ? 'marked_paid' : 'none',
  });
});

/**
 * GET /api/internal/branding
 *
 * Store branding for services that send email but have no database connection.
 *
 * event-bus owns the entire order lifecycle mail — confirmation, shipped, delivered — and
 * had no way to read the `Settings` document, so it rendered every one of those emails with
 * no logo, no store name in the sender, no support address and no postal address, while
 * Main-server's copies of the same templates had all of it.
 */
router.get('/branding', async (_req: Request, res: Response) => {
  try {
    const brand = await getBrand();
    return res.status(200).json({ data: brand });
  } catch (error) {
    logger.error('Failed to resolve branding for internal consumer:', error);
    return res.status(500).json({ error: 'Failed to resolve branding' });
  }
});

/**
 * GET /api/internal/email/marketing-consent?email=…
 *
 * Whether an address may be sent marketing email, plus its signed unsubscribe token.
 *
 * event-bus sends the post-delivery review request but has no database, so it cannot check
 * an opt-out or sign a link itself. Both come from here in one call.
 */
router.get('/email/marketing-consent', async (req: Request, res: Response) => {
  const email = String(req.query.email ?? '');
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    return res.status(200).json({
      data: {
        allowed: await isMarketingAllowed(email),
        unsubscribeToken: signUnsubscribeToken(email),
      },
    });
  } catch (error) {
    logger.error(`Failed to resolve marketing consent for ${email}:`, error);
    return res.status(500).json({ error: 'Failed to resolve marketing consent' });
  }
});

export default router;
