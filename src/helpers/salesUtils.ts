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
 * Returns { available, variantIndex, discount, amountOff }
 */
export function checkSaleAvailability(
  sale: SalesType | null,
  attributes?: { name: string; value: string }[]
): { available: boolean; variantIndex?: number; discount?: number; amountOff?: number } {
  if (!sale) return { available: false };
  if (sale.type === 'Flash') {
    const now = new Date();
    if (!sale.startDate || !sale.endDate || sale.startDate > now || sale.endDate < now) {
      return { available: false };
    }
  }

  // Helper to check if value is null or 'all'/'All'
  const isAllOrNull = (value: string | null | undefined): boolean => {
    return value === null || value === undefined || value === 'all' || value === 'All';
  };

  // If sale has variants, try to match attributes
  if (Array.isArray(sale.variants) && sale.variants.length > 0) {
    // First, check for general sales (applies to all)
    const generalSaleIdx = sale.variants.findIndex(
      (v) => isAllOrNull(v.attributeName) && (v.maxBuys === 0 || v.boughtCount < v.maxBuys)
    );

    if (generalSaleIdx !== -1) {
      const variant = sale.variants[generalSaleIdx]!;
      return {
        available: variant.maxBuys === 0 || variant.boughtCount < variant.maxBuys,
        variantIndex: generalSaleIdx,
        discount: variant.discount,
        amountOff: variant.amountOff,
      };
    }

    // Then try to find exact attribute match if attributes are provided
    if (attributes && attributes.length > 0) {
      const exactMatchIdx = sale.variants.findIndex(
        (v) =>
          v.attributeName === attributes[0]?.name &&
          v.attributeValue === attributes[0]?.value &&
          (v.maxBuys === 0 || v.boughtCount < v.maxBuys)
      );
      if (exactMatchIdx !== -1) {
        const variant = sale.variants[exactMatchIdx]!;
        return {
          available: variant.maxBuys === 0 || variant.boughtCount < variant.maxBuys,
          variantIndex: exactMatchIdx,
          discount: variant.discount,
          amountOff: variant.amountOff,
        };
      }
    }

    return { available: false };
  }

  // No variants, check sale-wide limits
  return { available: true, discount: 0, amountOff: 0 };
}

/**
 * Returns the discount to apply for a product (and variant if matched).
 * Returns { discount, amountOff } - use discount for percentage, amountOff for fixed amount
 */
export function getSaleDiscount(
  sale: SalesType | null,
  attributes?: { name: string; value: string }[]
): { discount: number; amountOff: number } {
  if (!sale) return { discount: 0, amountOff: 0 };

  if (Array.isArray(sale.variants) && sale.variants.length > 0) {
    // First, try to find exact attribute match if attributes are provided
    if (attributes && attributes.length > 0) {
      const exactMatch = sale.variants.find(
        (v) => v.attributeName === attributes[0]?.name && v.attributeValue === attributes[0]?.value
      );
      if (exactMatch) {
        return {
          discount: exactMatch.discount || 0,
          amountOff: exactMatch.amountOff || 0,
        };
      }
    }

    // If no exact match, look for general sales (null attributeName and attributeValue)
    const generalSale = sale.variants.find((v) => v.attributeName === null && v.attributeValue === null);
    if (generalSale) {
      return {
        discount: generalSale.discount || 0,
        amountOff: generalSale.amountOff || 0,
      };
    }
  }

  // No top-level discount in current schema
  return { discount: 0, amountOff: 0 };
}
