/**
 * Option combinations ("variants"): a price and stock for one exact choice across a product's
 * option groups, e.g. Metal: Gold + Size: 7 → ₦85,000, 2 in stock.
 *
 * A product without variants works as before: one stock count, price from the first priced option
 * or the product. When a product has variants:
 *  - a selection is sold only when it matches one of them (combinations that aren't listed can't be
 *    bought);
 *  - that variant's stock is what can be sold, and the product's `stock` is the sum of all of them;
 *  - that variant's price, when set, is the list price. Without one, the option/product price applies.
 *
 * Pure: no database access. The storefront mirrors `findVariant` in `src/lib/variants.ts`.
 */

export interface VariantOptionValue {
  name: string;
  value: string;
}

export interface ProductVariant {
  /** `variantKey(options)`; lets an order find its variant again for stock updates. */
  key: string;
  options: VariantOptionValue[];
  price?: number | null;
  stock: number;
  sku?: string | null;
}

interface AttributeGroupLike {
  name: string;
  children?: Array<{ name: string }> | null;
}

/** Order-independent identity of a combination: `Metal=Gold|Size=7` (groups sorted by name). */
export const variantKey = (options: VariantOptionValue[]): string =>
  [...options]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((o) => `${o.name}=${o.value}`)
    .join('|');

export const hasVariants = (product: { variants?: unknown[] | null }): boolean => (product.variants?.length ?? 0) > 0;

/** The variant whose every option matches the selection (extra selected groups are ignored). */
export function findVariant<V extends { options: VariantOptionValue[] }>(
  variants: V[] | null | undefined,
  selected: VariantOptionValue[] | null | undefined = []
): V | undefined {
  if (!variants?.length) return undefined;
  const picked = new Map((selected ?? []).map((a) => [a.name, a.value]));
  return variants.find((v) => v.options.length > 0 && v.options.every((o) => picked.get(o.name) === o.value));
}

/** How many units of this selection can be sold. */
export function availableStock(
  product: { stock?: number | null; variants?: ProductVariant[] | null },
  selected: VariantOptionValue[] | null | undefined
): number {
  if (!hasVariants(product)) return product.stock ?? 0;
  return findVariant(product.variants, selected)?.stock ?? 0;
}

/**
 * Checks the admin's combinations against the product's option groups and fills in their keys.
 * Every combination must use the same groups, each value must exist in its group, and no
 * combination may appear twice.
 */
export function normaliseVariants(
  input: unknown,
  attributes: AttributeGroupLike[] | null | undefined
): { variants: ProductVariant[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { variants: [] };

  const groups = new Map((attributes ?? []).map((g) => [g.name, new Set((g.children ?? []).map((c) => c.name))]));
  const seen = new Set<string>();
  let groupSet: string | null = null;
  const variants: ProductVariant[] = [];

  for (const raw of input as Array<Partial<ProductVariant>>) {
    const options = (Array.isArray(raw?.options) ? raw.options : [])
      .filter((o): o is VariantOptionValue => !!o && typeof o.name === 'string' && typeof o.value === 'string')
      .map((o) => ({ name: o.name.trim(), value: o.value.trim() }));
    if (options.length === 0) return { error: 'Each combination needs at least one option' };

    const label = options.map((o) => `${o.name}: ${o.value}`).join(', ');
    const names = options.map((o) => o.name);
    if (new Set(names).size !== names.length) return { error: `Combination "${label}" uses an option group twice` };
    for (const o of options) {
      if (!groups.get(o.name)?.has(o.value)) return { error: `Combination "${label}": "${o.name}: ${o.value}" is not one of the product's options` };
    }

    const thisGroupSet = [...names].sort().join('|');
    if (groupSet === null) groupSet = thisGroupSet;
    else if (groupSet !== thisGroupSet) return { error: 'All combinations must use the same option groups' };

    const key = variantKey(options);
    if (seen.has(key)) return { error: `Combination "${label}" is listed twice` };
    seen.add(key);

    const stock = Number(raw.stock ?? 0);
    if (!Number.isInteger(stock) || stock < 0) return { error: `Combination "${label}": stock must be a whole number, 0 or more` };
    const price = raw.price === null || raw.price === undefined || (raw.price as unknown) === '' ? undefined : Number(raw.price);
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return { error: `Combination "${label}": price must be 0 or more` };
    const sku = typeof raw.sku === 'string' && raw.sku.trim() ? raw.sku.trim() : undefined;

    variants.push({ key, options, stock, ...(price !== undefined ? { price } : {}), ...(sku ? { sku } : {}) });
  }

  return { variants };
}

export const totalVariantStock = (variants: ProductVariant[]): number => variants.reduce((sum, v) => sum + v.stock, 0);
