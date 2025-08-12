import Sales, { SalesType } from '../models/Sales';
import { Types } from 'mongoose';

/**
 * Finds an active sale for a product, optionally matching type and date.
 */
export async function findActiveSaleForProduct(productId: string, options?: { type?: SalesType['type']; now?: Date }) {
  const now = options?.now || new Date();
  const match: Record<string, unknown> = {
    product: new Types.ObjectId(productId),
    isActive: true,
    deleted: { $ne: true },
  };
  if (options?.type) (match as { type: SalesType['type'] }).type = options.type;
  // For Flash sales, check date range
  if (options?.type === 'Flash') {
    (match as { startDate: { $lte: Date }; endDate: { $gte: Date } }).startDate = { $lte: now };
    (match as { startDate: { $lte: Date }; endDate: { $gte: Date } }).endDate = { $gte: now };
  }
  return Sales.findOne(match);
}

/**
 * Checks if a sale or its variant is available for use (for Limited/Flash sales).
 * Returns { available, variantIndex, discount }
 */
export function checkSaleAvailability(
  sale: SalesType | null,
  attributes?: { name: string; value: string }[]
): { available: boolean; variantIndex?: number; discount?: number } {
  if (!sale) return { available: false };
  // If sale has variants, try to match attributes
  if (Array.isArray(sale.variants) && sale.variants.length > 0 && attributes) {
    const idx = sale.variants.findIndex(
      (v) =>
        v.attributeName === attributes[0]?.name &&
        v.attributeValue === attributes[0]?.value &&
        (v.maxBuys === 0 || v.boughtCount < v.maxBuys)
    );
    if (idx !== -1) {
      const variant = sale.variants[idx]!;
      return {
        available:
          (sale.type !== 'Limited' || (sale.limit ?? 0) > 0) &&
          (variant.maxBuys === 0 || variant.boughtCount < variant.maxBuys),
        variantIndex: idx,
        discount: variant.discount,
      };
    }
    return { available: false };
  }
  // No variants, check sale-wide limits
  if (sale.type === 'Limited' && (sale.limit ?? 0) < 1) return { available: false };
  return { available: true, discount: (sale as SalesType & { discount?: number }).discount || 0 };
}

/**
 * Returns the discount to apply for a product (and variant if matched).
 */
export function getSaleDiscount(sale: SalesType | null, attributes?: { name: string; value: string }[]) {
  if (!sale) return 0;
  if (Array.isArray(sale.variants) && sale.variants.length > 0 && attributes) {
    const variant = sale.variants.find(
      (v) => v.attributeName === attributes[0]?.name && v.attributeValue === attributes[0]?.value
    );
    return variant ? variant.discount : 0;
  }
  return (sale as SalesType & { discount?: number }).discount || 0;
}
