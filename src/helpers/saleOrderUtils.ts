import { ClientSession } from 'mongoose';
import Sales from '../models/Sales';
import { Types } from 'mongoose';

// Type for a product item in the order/cart with sale info
export interface SaleOrderProduct {
  product: Types.ObjectId | string;
  qty: number;
  sale?: Types.ObjectId | string;
  saleType?: 'Flash' | 'Limited' | 'Normal';
  saleVariantIndex?: number;
  saleDiscount?: number;
  attributes?: { name: string; value: string }[];
}

// Snapshot of sale state at order creation time
export interface SaleSnapshot {
  type: 'Flash' | 'Limited' | 'Normal';
  variantIndex: number;
  maxBuys: number;
  boughtCount: number;
  attributeName?: string | null;
  attributeValue?: string | null;
}

/**
 * Atomically update sale/variant counters for Limited/Flash sales.
 * - Track variant boughtCount for Limited OR Flash with maxBuys > 0
 * - Increment boughtCount for variant if present
 * - Return snapshots for order persistence
 */
export async function updateSaleCountersOnOrder(
  products: SaleOrderProduct[],
  session: ClientSession
): Promise<Map<string, SaleSnapshot>> {
  const snapshots = new Map<string, SaleSnapshot>();

  for (const item of products) {
    try {
      if (!item.sale) continue;
      const sale = await Sales.findById(item.sale).session(session);
      if (!sale) continue;

      // Handle Limited sales OR Flash sales with quantity limits
      if (typeof item.saleVariantIndex === 'number') {
        const variant = sale.variants[item.saleVariantIndex];
        if (!variant) continue;

        // Only track boughtCount for Limited OR Flash with maxBuys > 0
        const shouldTrack = sale.type === 'Limited' || (sale.type === 'Flash' && variant.maxBuys > 0);

        if (shouldTrack && typeof variant.boughtCount === 'number') {
          variant.boughtCount += item.qty;
          await sale.save({ session });

          // Create snapshot for this product
          const snapshot: SaleSnapshot = {
            type: sale.type,
            variantIndex: item.saleVariantIndex,
            maxBuys: variant.maxBuys,
            boughtCount: variant.boughtCount - item.qty, // Store state before increment
            attributeName: variant.attributeName || null,
            attributeValue: variant.attributeValue || null,
          };

          snapshots.set(item.product.toString(), snapshot);
        }
      }
    } catch (err) {
      console.error(`Failed to update sale counters for product ${item.product}:`, err);
      // Continue processing other items
    }
  }

  return snapshots;
}

/**
 * Reverse sale counters when order is cancelled or payment fails.
 * - Uses atomic updateOne with array filters for safe concurrent updates
 * - Reactivates sale if variant is no longer exhausted
 * - Validates Flash sale time window before reactivation
 * - Gracefully skips products without snapshots
 */
export async function reverseSaleCountersOnCancel(
  products: Array<{
    product: Types.ObjectId | string;
    qty: number;
    sale?: Types.ObjectId | string;
    saleSnapshot?: SaleSnapshot;
  }>,
  session: ClientSession
): Promise<void> {
  for (const item of products) {
    try {
      // Skip if no sale or no snapshot (old orders)
      if (!item.sale || !item.saleSnapshot) continue;

      const saleId = item.sale;
      const snapshot = item.saleSnapshot;

      // Verify sale still exists
      const sale = await Sales.findById(saleId).session(session);
      if (!sale) {
        console.warn(`Sale ${saleId} not found for reversal, skipping`);
        continue;
      }

      // Verify sale type matches snapshot (sale might have been changed)
      if (sale.type !== snapshot.type) {
        console.warn(`Sale ${saleId} type changed from ${snapshot.type} to ${sale.type}, skipping reversal`);
        continue;
      }

      // Only reverse for Limited OR Flash with maxBuys > 0
      const shouldReverse = sale.type === 'Limited' || (sale.type === 'Flash' && snapshot.maxBuys > 0);
      if (!shouldReverse) continue;

      // Atomically decrement boughtCount using updateOne with array filters
      const result = await Sales.updateOne(
        {
          _id: saleId,
          'variants': { $exists: true },
        },
        {
          $inc: { [`variants.${snapshot.variantIndex}.boughtCount`]: -item.qty },
        },
        {
          session,
        }
      );

      if (result.modifiedCount === 0) {
        console.warn(`Failed to reverse boughtCount for sale ${saleId}, variant ${snapshot.variantIndex}`);
        continue;
      }

      // Fetch updated sale to check if reactivation is needed
      const updatedSale = await Sales.findById(saleId).session(session);
      if (!updatedSale) continue;

      const variant = updatedSale.variants[snapshot.variantIndex];
      if (!variant) continue;

      // Check if sale should be reactivated (variant no longer exhausted)
      const wasExhausted = snapshot.boughtCount >= snapshot.maxBuys && snapshot.maxBuys > 0;
      const isNowAvailable = variant.boughtCount < variant.maxBuys && variant.maxBuys > 0;

      if (wasExhausted && isNowAvailable && !updatedSale.isActive) {
        // For Flash sales, also check time window
        let canReactivate = true;
        if (updatedSale.type === 'Flash') {
          const now = new Date();
          if (!updatedSale.startDate || !updatedSale.endDate) {
            canReactivate = false;
          } else if (updatedSale.startDate > now || updatedSale.endDate < now) {
            canReactivate = false;
            console.log(`Flash sale ${saleId} outside time window, not reactivating`);
          }
        }

        if (canReactivate) {
          updatedSale.isActive = true;
          await updatedSale.save({ session });
          console.log(`Sale ${saleId} reactivated after order cancellation (variant ${snapshot.variantIndex})`);

          // TODO: Publish SALE_REACTIVATED event for websocket notifications
          // await eventPublisher.publishSaleReactivated({
          //   saleId: saleId.toString(),
          //   productId: item.product.toString(),
          //   type: updatedSale.type,
          //   variantIndex: snapshot.variantIndex,
          // });
        }
      }
    } catch (err) {
      console.error(`Failed to reverse sale counters for product ${item.product}:`, err);
      // Continue processing other items
    }
  }
}
