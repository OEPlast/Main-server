import mongoose, { ClientSession } from 'mongoose';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Coupon from '@/models/Coupon';
import CouponRedemption from '@/models/CouponRedemption';
import { reverseSaleCountersOnCancel } from '@/helpers/saleOrderUtils';
import { publishLiveProductUpdates } from '@/helpers/liveProductUpdates';
import { logger } from '@/lib/logger';

/**
 * Hands back the coupon usage an order consumed.
 *
 * Usage limits are enforced from two places: `CouponRedemption` rows (per-user and one-off checks)
 * and `timesUsed` / `usedBy` on the coupon (overall caps). An unpaid or cancelled order used to keep
 * both, so a one-off code was spent by an abandoned checkout.
 */
async function releaseCouponUsage(orderId: mongoose.Types.ObjectId, session: ClientSession): Promise<void> {
  const redemptions = await CouponRedemption.find({ order: orderId }).session(session);

  for (const redemption of redemptions) {
    const coupon = await Coupon.findById(redemption.coupon).select('timesUsed usedBy').session(session);
    if (!coupon) continue;

    // Remove one occurrence of the user, not every one: per-user limits count repeats.
    const usedBy = [...(coupon.usedBy ?? [])];
    const index = usedBy.findIndex((id) => id.toString() === redemption.user.toString());
    if (index >= 0) usedBy.splice(index, 1);

    await Coupon.updateOne(
      { _id: coupon._id },
      { $set: { usedBy, timesUsed: Math.max(0, (coupon.timesUsed ?? 0) - 1) } },
      { session }
    );
  }

  await CouponRedemption.deleteMany({ order: orderId }, { session });
}

/**
 * Returns an order's stock, sale allocation and coupon usage, inside the caller's transaction.
 * Only the first call for an order does anything.
 *
 * Stock used to be put back in five separate places (payment verify, the webhook, checkout,
 * the expiry route and customer cancel), none of which knew whether another had already run. A
 * customer cancel followed by the payment timeout restored the same stock twice, which then sold
 * as phantom inventory. `inventoryReleasedAt` is claimed in the same transaction as the release,
 * so a second caller finds it set and stops.
 *
 * @returns the released product ids (empty when it was already released). The caller publishes
 *          live product updates after its transaction commits.
 */
export async function releaseOrderInventoryInSession(
  orderId: string | mongoose.Types.ObjectId,
  session: ClientSession
): Promise<{ released: boolean; productIds: string[] }> {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, inventoryReleasedAt: { $exists: false } },
    { $set: { inventoryReleasedAt: new Date() } },
    { new: true, session }
  );
  if (!order) return { released: false, productIds: [] };

  const lines = order.products.filter((item) => item.product && item.qty);

  if (lines.length > 0) {
    await Product.bulkWrite(
      lines.map((item) => ({
        updateOne: { filter: { _id: item.product! }, update: { $inc: { stock: item.qty! } } },
      })),
      { session }
    );
  }

  await reverseSaleCountersOnCancel(
    lines.map((item) => ({
      product: item.product!,
      qty: item.qty!,
      sale: item.sale || undefined,
      saleSnapshot: item.saleSnapshot
        ? {
            type: item.saleSnapshot.type!,
            variantIndex: item.saleSnapshot.variantIndex!,
            maxBuys: item.saleSnapshot.maxBuys!,
            boughtCount: item.saleSnapshot.boughtCount!,
            attributeName: item.saleSnapshot.attributeName || undefined,
            attributeValue: item.saleSnapshot.attributeValue || undefined,
          }
        : undefined,
    })),
    session
  );

  await releaseCouponUsage(order._id as mongoose.Types.ObjectId, session);

  logger.info(`Inventory released for order ${orderId.toString()} (${lines.length} lines)`);
  return { released: true, productIds: lines.map((item) => item.product!.toString()) };
}

/** Pushes restored stock to open product pages. Call after the releasing transaction commits. */
export function announceReleasedInventory(productIds: string[]): void {
  if (productIds.length > 0) void publishLiveProductUpdates(productIds);
}
