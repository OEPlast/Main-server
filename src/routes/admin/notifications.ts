import express, { Request, Response } from 'express';
import Order from '@/models/Order';
import Return from '@/models/Return';
import Transaction from '@/models/Transaction';
import Product from '@/models/Product';
import { authenticateUser, isAdmin } from '@/middleware/auth';

const router = express.Router();
router.use(authenticateUser, isAdmin);

const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface StaffNotification {
  id: string;
  kind: 'order' | 'return' | 'transaction' | 'inventory';
  title: string;
  detail?: string;
  at: Date;
  /** Admin-app path to open. */
  href: string;
}

/**
 * GET /admin/notifications/summary
 *
 * What needs a staff member's attention right now: paid orders not yet shipped, returns awaiting
 * review, payments flagged for review, and products at or under their low-stock threshold, plus
 * the most recent items of each. The admin app polls it for the notification bell, which was
 * rendering demo data.
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - RECENT_WINDOW_MS);

    const [ordersToFulfil, pendingReturns, transactionsForReview, lowStock, recentOrders, recentReturns, flagged] =
      await Promise.all([
        Order.countDocuments({ status: 'Processing', isPaid: true, deliveredAt: { $exists: false } }),
        Return.countDocuments({ status: 'pending', deleted: { $ne: true } }),
        Transaction.countDocuments({ 'review.required': true }),
        Product.countDocuments({ status: 'active', $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
        Order.find({ isPaid: true, paidAt: { $gte: since } })
          .sort({ paidAt: -1 })
          .limit(10)
          .select('_id orderNumber total paidAt')
          .lean(),
        Return.find({ requestedAt: { $gte: since }, deleted: { $ne: true } })
          .sort({ requestedAt: -1 })
          .limit(10)
          .select('_id returnNumber status requestedAt')
          .lean(),
        Transaction.find({ 'review.required': true })
          .sort({ 'review.flaggedAt': -1 })
          .limit(10)
          .select('_id reference amount review')
          .lean(),
      ]);

    const items: StaffNotification[] = [
      ...recentOrders.map((o) => ({
        id: `order:${o._id.toString()}`,
        kind: 'order' as const,
        title: `New paid order ${o.orderNumber ?? ''}`.trim(),
        detail: typeof o.total === 'number' ? `₦${o.total.toLocaleString()}` : undefined,
        at: o.paidAt ?? new Date(),
        href: `/ecommerce/orders/${o._id.toString()}`,
      })),
      ...recentReturns.map((r) => ({
        id: `return:${r._id.toString()}`,
        kind: 'return' as const,
        title: `Return request ${r.returnNumber}`,
        detail: r.status,
        at: r.requestedAt ?? new Date(),
        href: `/ecommerce/returns/${r._id.toString()}`,
      })),
      ...flagged.map((t) => ({
        id: `transaction:${t._id.toString()}`,
        kind: 'transaction' as const,
        title: `Payment needs review (₦${t.amount.toLocaleString()})`,
        detail: t.review?.reason,
        at: t.review?.flaggedAt ?? new Date(),
        href: `/transactions/${t._id.toString()}`,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return res.status(200).json({
      message: 'Notification summary',
      data: {
        counts: { ordersToFulfil, pendingReturns, transactionsForReview, lowStock },
        items: items.slice(0, 20),
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error building notification summary:', error);
    return res.status(500).json({ message: 'Failed to load notifications', data: null, code: 500 });
  }
});

export default router;
