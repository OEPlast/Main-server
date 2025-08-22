// Shared pricing utilities and types

export interface PricingTier {
  minQty: number;
  maxQty?: number;
  strategy: 'fixedPrice' | 'percentOff' | 'amountOff';
  value: number;
}

export interface VariantOption {
  name: string;
  price?: number;
  discount?: number;
  stock: number;
  image: string;
  pricingTiers?: PricingTier[];
}

export interface AttributeGroup {
  name: string;
  children: VariantOption[];
}

export interface ProductPricingShape {
  price: number;
  discount?: number;
  pricingTiers?: PricingTier[];
  attributes?: AttributeGroup[];
  stock: number;
}

// Resolve the most specific variant option across multiple attributes.
// Rule: iterate attribute groups in product order; if a selected option in that group exists and
// it carries any pricing signal (price | discount | pricingTiers), prefer the first such match.
export function resolveBestVariant(
  product: ProductPricingShape,
  attributes: { name: string; value: string }[]
): VariantOption | undefined {
  if (!product?.attributes || product.attributes.length === 0 || !attributes?.length) return undefined;
  // Build quick lookup of requested attributes by name
  const picked = new Map<string, string>();
  for (const a of attributes) picked.set(a.name, a.value);

  for (const group of product.attributes) {
    const requested = picked.get(group.name);
    if (!requested) continue;
    const option = group.children.find((c) => c.name === requested);
    if (!option) continue;
    if (
      typeof option.price === 'number' ||
      typeof option.discount === 'number' ||
      (Array.isArray(option.pricingTiers) && option.pricingTiers.length > 0)
    ) {
      return option;
    }
  }
  return undefined;
}

export function applyPricingTier(base: number, qty: number, tiers?: PricingTier[]): number {
  if (!tiers || tiers.length === 0) return base;
  // Find all matching tiers and pick the most specific (highest minQty)
  const applicable = tiers.filter((t) => qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty));
  if (applicable.length === 0) return base;
  const tier = applicable.sort((a, b) => b.minQty - a.minQty)[0]!;
  switch (tier.strategy) {
    case 'fixedPrice':
      return tier.value;
    case 'percentOff':
      return Math.max(0, base - (base * tier.value) / 100);
    case 'amountOff':
      return Math.max(0, base - tier.value);
    default:
      return base;
  }
}
