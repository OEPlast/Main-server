import mongoose, { Types } from 'mongoose';
import cron from 'node-cron';
import Product from '@/models/Product';
import { logger } from '@/lib/logger';

/**
 * "Back in stock": products that were sold out and have stock again, for the back-in-stock
 * collection and badge. A product is stamped `soldOutAt` when its stock is 0, and `restockedAt`
 * when stock returns while it carries that stamp.
 *
 * Off unless BACK_IN_STOCK_DAYS is set (Doreti: 30), so other deployments write nothing.
 */

export const backInStockDays = (): number | null => {
  const days = Number(process.env.BACK_IN_STOCK_DAYS);
  return Number.isFinite(days) && days > 0 ? days : null;
};

export const backInStockCutoff = (days: number) => new Date(Date.now() - days * 86_400_000);

/** Stamps sold-out and restocked products (all of them, or just `ids`). */
export async function syncRestockMarkers(ids?: Array<string | Types.ObjectId>): Promise<{ soldOut: number; restocked: number }> {
  if (!backInStockDays()) return { soldOut: 0, restocked: 0 };
  const scope = ids ? { _id: { $in: ids.filter((id) => mongoose.Types.ObjectId.isValid(String(id))) } } : {};
  const now = new Date();
  const [soldOut, restocked] = await Promise.all([
    Product.updateMany({ ...scope, stock: { $lte: 0 }, soldOutAt: { $exists: false } }, { $set: { soldOutAt: now } }),
    Product.updateMany({ ...scope, stock: { $gt: 0 }, soldOutAt: { $exists: true } }, { $set: { restockedAt: now }, $unset: { soldOutAt: 1 } }),
  ]);
  return { soldOut: soldOut.modifiedCount, restocked: restocked.modifiedCount };
}

/** Hourly: marks products that sold out since the last run (restocks are marked as they happen). */
export function startRestockMarkers(): void {
  if (!backInStockDays()) return;
  const run = () =>
    syncRestockMarkers()
      .then((r) => {
        if (r.soldOut || r.restocked) logger.info(`[back-in-stock] ${r.soldOut} sold out, ${r.restocked} restocked`);
      })
      .catch((error) => logger.error('[back-in-stock] marker sync failed', error));
  void run();
  cron.schedule('5 * * * *', run);
  logger.info('[back-in-stock] Started: hourly');
}
