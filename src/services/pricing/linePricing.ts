/**
 * The one formula for what a cart line costs. Cart validation at checkout, order creation (the
 * amount Paystack charges) and the storefront's cart display (`storefront/src/utils/cart-pricing.ts`,
 * which mirrors this file) must all agree, or a shopper confirms one price and pays another.
 * Before this module existed they did not: order creation dropped the bulk-tier discount whenever
 * a sale applied, and checkout added an option's price on top of the product price.
 *
 * Order of operations (owner decision, 2026-09-15: "sale on top of tier"):
 *   1. List price: the selected option's own price when it has one, else the product price.
 *   2. Bulk tier: the option's tiers when it has any, else the product's. The matching tier with
 *      the highest minQty wins. A tier never raises the price.
 *   3. Sale: taken off the tier price (percent of it, or a fixed amount capped at it).
 *
 * Pure: no database access. `priceCart.ts` loads the product and sale documents.
 */

export type TierStrategy = 'fixedPrice' | 'percentOff' | 'amountOff';

export interface PricingTier {
  minQty: number;
  maxQty?: number | null;
  strategy: TierStrategy;
  value: number;
}

export interface PricingOption {
  name: string;
  price?: number | null;
  pricingTiers?: PricingTier[] | null;
}

export interface PricingProduct {
  price: number;
  pricingTiers?: PricingTier[] | null;
  attributes?: Array<{ name: string; children: PricingOption[] }> | null;
}

export type SaleType = 'Flash' | 'Limited' | 'Normal';

export interface PricingSaleVariant {
  attributeName?: string | null;
  attributeValue?: string | null;
  discount?: number | null;
  amountOff?: number | null;
  maxBuys?: number | null;
  boughtCount?: number | null;
}

export interface PricingSale {
  _id: unknown;
  type: SaleType;
  isActive?: boolean | null;
  deleted?: boolean | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  campaign?: unknown;
  variants?: PricingSaleVariant[] | null;
}

export interface SelectedAttribute {
  name: string;
  value: string;
}

export interface AppliedSale {
  saleId: string;
  type: SaleType;
  variantIndex: number;
  attributeName: string | null;
  attributeValue: string | null;
  /** Naira taken off each unit by the sale. */
  unitDiscount: number;
}

export interface LinePrice {
  qty: number;
  /** Before tier and sale. */
  listUnitPrice: number;
  /** After the bulk tier, before the sale. */
  tierUnitPrice: number;
  /** What the shopper pays per unit, rounded to kobo. */
  unitPrice: number;
  lineTotal: number;
  tier: PricingTier | null;
  sale: AppliedSale | null;
  /** Naira given away on this line, by source. */
  tierDiscountTotal: number;
  saleDiscountTotal: number;
}

export const roundKobo = (value: number): number => Math.round(value * 100) / 100;

const isAll = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value === '' || value.toLowerCase() === 'all';

/** The selected option that carries its own price or tiers (first attribute group wins). */
export function resolvePricedOption(
  product: PricingProduct,
  selected: SelectedAttribute[] = []
): PricingOption | undefined {
  if (!product.attributes?.length || !selected.length) return undefined;
  const picked = new Map(selected.map((a) => [a.name, a.value]));
  for (const group of product.attributes) {
    const value = picked.get(group.name);
    if (!value) continue;
    const option = group.children?.find((c) => c.name === value);
    if (option && (typeof option.price === 'number' || (option.pricingTiers?.length ?? 0) > 0)) return option;
  }
  return undefined;
}

export function findTier(qty: number, tiers?: PricingTier[] | null): PricingTier | null {
  if (!tiers?.length) return null;
  const matching = tiers.filter((t) => qty >= t.minQty && (t.maxQty == null || t.maxQty === 0 || qty <= t.maxQty));
  if (!matching.length) return null;
  return [...matching].sort((a, b) => b.minQty - a.minQty)[0] ?? null;
}

export function applyTier(price: number, tier: PricingTier | null): number {
  if (!tier) return price;
  switch (tier.strategy) {
    case 'fixedPrice':
      return Math.min(price, Math.max(0, tier.value));
    case 'percentOff':
      return Math.max(0, price - (price * tier.value) / 100);
    case 'amountOff':
      return Math.max(0, price - tier.value);
    default:
      return price;
  }
}

/**
 * Which of a sale's variants applies to this line, if any.
 *  - The sale must be active and not deleted; a Flash sale must be inside its dates.
 *  - Variant rules, first match wins: no attribute → every line; attribute with value "all" → any
 *    value of that attribute; attribute + value → exact match.
 *  - A variant with a unit cap (maxBuys > 0) only applies when the whole line fits in what is left,
 *    so a capped sale can never be oversold.
 */
export function matchSaleVariant(
  sale: PricingSale | null | undefined,
  selected: SelectedAttribute[] = [],
  qty: number,
  now: Date = new Date()
): { index: number; variant: PricingSaleVariant } | null {
  if (!sale || !sale.isActive || sale.deleted) return null;
  if (sale.type === 'Flash') {
    if (!sale.startDate || !sale.endDate) return null;
    if (now < new Date(sale.startDate) || now > new Date(sale.endDate)) return null;
  }

  const variants = sale.variants ?? [];
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index]!;
    const name = variant.attributeName;
    const value = variant.attributeValue;

    const matches = isAll(name)
      ? true
      : isAll(value)
        ? selected.length === 0 || selected.some((a) => a.name === name)
        : selected.some((a) => a.name === name && a.value === value);
    if (!matches) continue;

    const maxBuys = variant.maxBuys ?? 0;
    if (maxBuys > 0 && qty > maxBuys - (variant.boughtCount ?? 0)) return null;
    const hasDiscount = (variant.amountOff ?? 0) > 0 || (variant.discount ?? 0) > 0;
    return hasDiscount ? { index, variant } : null;
  }
  return null;
}

export function priceLine(input: {
  product: PricingProduct;
  qty: number;
  selectedAttributes?: SelectedAttribute[];
  sale?: PricingSale | null;
  now?: Date;
}): LinePrice {
  const { product, qty } = input;
  const selected = input.selectedAttributes ?? [];

  const option = resolvePricedOption(product, selected);
  const listUnitPrice = typeof option?.price === 'number' ? option.price : product.price;

  const tiers = option?.pricingTiers?.length ? option.pricingTiers : product.pricingTiers;
  const tier = findTier(qty, tiers);
  const tierUnitPrice = applyTier(listUnitPrice, tier);

  const match = matchSaleVariant(input.sale, selected, qty, input.now);
  let unitDiscount = 0;
  if (match) {
    const amountOff = match.variant.amountOff ?? 0;
    unitDiscount =
      amountOff > 0 ? Math.min(amountOff, tierUnitPrice) : (tierUnitPrice * (match.variant.discount ?? 0)) / 100;
  }

  const unitPrice = roundKobo(Math.max(0, tierUnitPrice - unitDiscount));
  const roundedTierUnit = roundKobo(tierUnitPrice);
  const sale: AppliedSale | null =
    match && input.sale
      ? {
          saleId: String(input.sale._id),
          type: input.sale.type,
          variantIndex: match.index,
          attributeName: match.variant.attributeName ?? null,
          attributeValue: match.variant.attributeValue ?? null,
          unitDiscount: roundKobo(roundedTierUnit - unitPrice),
        }
      : null;

  return {
    qty,
    listUnitPrice: roundKobo(listUnitPrice),
    tierUnitPrice: roundedTierUnit,
    unitPrice,
    lineTotal: roundKobo(unitPrice * qty),
    tier: tier && roundedTierUnit < roundKobo(listUnitPrice) ? tier : null,
    sale,
    tierDiscountTotal: roundKobo((roundKobo(listUnitPrice) - roundedTierUnit) * qty),
    saleDiscountTotal: roundKobo((roundedTierUnit - unitPrice) * qty),
  };
}
