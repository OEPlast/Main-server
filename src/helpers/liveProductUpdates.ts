import { Types } from 'mongoose';
import Product from '@/models/Product';
import eventPublisher from '@/events/eventPublisher';

/**
 * Tells open storefront pages that these products changed, so they refetch.
 *
 * Rides the existing real-time path: PRODUCT_UPDATED -> event-bus -> websocket-gateway
 * `product_update` -> the product's socket room. The product page and cards already refetch on
 * that event, and the refetch is what carries the new numbers — including a Limited/Flash sale's
 * `boughtCount`, which drives the "Sold It" progress bar and "units left" text.
 *
 * Call it only AFTER the transaction that changed stock or sale counters has committed. A browser
 * that refetches before the commit reads the old values and keeps showing them.
 *
 * Never throws: a missed live update must not fail an order, cancellation or payment callback.
 */
export async function publishLiveProductUpdates(
  productIds: Array<string | Types.ObjectId | null | undefined>
): Promise<void> {
  try {
    const ids = [...new Set(productIds.filter(Boolean).map((id) => id!.toString()))];
    if (ids.length === 0) return;

    const products = await Product.find({ _id: { $in: ids } })
      .select('name price stock')
      .lean();

    await Promise.all(
      products.map((p) =>
        eventPublisher.publishProductUpdated(p._id.toString(), p.name ?? '', p.price ?? 0, p.stock ?? 0)
      )
    );
  } catch (error) {
    console.error('[live-product-updates] failed to publish product updates', error);
  }
}
