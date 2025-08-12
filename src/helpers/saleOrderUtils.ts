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

/**
 * Atomically update sale/variant counters for Limited/Flash sales.
 * - Decrement sale.limit for Limited
 * - Increment boughtCount for variant if present
 * - Mark inactive if needed
 */
export async function updateSaleCountersOnOrder(products: SaleOrderProduct[], session: ClientSession): Promise<void> {
  for (const item of products) {
    try {
      if (!item.sale) continue;
      const sale = await Sales.findById(item.sale).session(session);
      if (!sale) continue;
      // Handle Limited sale
      if (sale.type === 'Limited') {
        // Decrement sale limit
        if (typeof sale.limit === 'number' && sale.limit > 0) {
          sale.limit -= item.qty;
          if (sale.limit < 1) sale.isActive = false;
        }
        // Variant
        if (typeof item.saleVariantIndex === 'number' && sale.variants[item.saleVariantIndex]) {
          const variant = sale.variants[item.saleVariantIndex]!;
          if (typeof variant.boughtCount === 'number') {
            variant.boughtCount += item.qty;
            if (variant.maxBuys > 0 && variant.boughtCount >= variant.maxBuys) {
              // Optionally mark variant as inactive (custom logic)
            }
          }
        }
        await sale.save({ session });
      }
      // Handle Flash sale (date-based, no limit decrement, but can increment boughtCount)
      if (sale.type === 'Flash') {
        if (typeof item.saleVariantIndex === 'number' && sale.variants[item.saleVariantIndex]) {
          const variant = sale.variants[item.saleVariantIndex]!;
          if (typeof variant.boughtCount === 'number') {
            variant.boughtCount += item.qty;
          }
        }
        await sale.save({ session });
      }
    } catch (err) {
      console.error(`Failed to update sale counters for product ${item.product}:`, err);
      // Optionally: continue; or throw to abort all
    }
  }
}
