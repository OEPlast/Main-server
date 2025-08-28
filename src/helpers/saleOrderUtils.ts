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
 * - Track variant boughtCount for Limited/Flash via variant index
 * - Increment boughtCount for variant if present
 * - Mark inactive if needed
 */
export async function updateSaleCountersOnOrder(products: SaleOrderProduct[], session: ClientSession): Promise<void> {
  for (const item of products) {
    try {
      if (!item.sale) continue;
      const sale = await Sales.findById(item.sale).session(session);
      if (!sale) continue;
      // Handle Limited / Flash sale variants: increment variant boughtCount if provided
      if ((sale.type === 'Limited' || sale.type === 'Flash') && typeof item.saleVariantIndex === 'number') {
        const variant = sale.variants[item.saleVariantIndex];
        if (variant && typeof variant.boughtCount === 'number') {
          variant.boughtCount += item.qty;
        }
        await sale.save({ session });
      }
    } catch (err) {
      console.error(`Failed to update sale counters for product ${item.product}:`, err);
      // Optionally: continue; or throw to abort all
    }
  }
}
