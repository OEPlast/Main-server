/**
 * Product extras: optional add-ons sold with a product that aren't products themselves, each with
 * its own price (0 = free), e.g. "Tester +₦18,000" or "Silver polish — free". The shopper ticks the
 * ones they want; each ticked extra adds its price to every unit of the line.
 *
 * A ticked extra travels with the line as a selected attribute `{ name: "Add-on", value: <extra> }`,
 * so carts, orders, emails and the admin show it like any other option without new fields. Extras
 * are added after bulk tiers and sales: those discount the item, not its extras.
 *
 * Pure: no database access. The storefront mirrors `extrasUnitPrice` in `src/lib/pricing.ts`.
 */

export const EXTRA_ATTRIBUTE = 'Add-on';
export const MAX_EXTRAS = 10;

export interface ProductExtra {
  name: string;
  /** Naira per unit; 0 means free. */
  price: number;
  description?: string;
}

/** Sum of the ticked extras' prices for one unit (each extra counted once; unknown ones ignored). */
export function extrasUnitPrice(
  extras: ProductExtra[] | null | undefined,
  selected: Array<{ name: string; value: string }> | null | undefined
): number {
  if (!extras?.length || !selected?.length) return 0;
  const ticked = new Set(selected.filter((a) => a.name === EXTRA_ATTRIBUTE).map((a) => a.value));
  return extras.reduce((sum, e) => (ticked.has(e.name) ? sum + Math.max(0, e.price) : sum), 0);
}

/** Checks the admin's extras: named, non-negative price, unique names, at most `MAX_EXTRAS`. */
export function normaliseExtras(input: unknown): { extras: ProductExtra[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { extras: [] };
  if (input.length > MAX_EXTRAS) return { error: `A product can have at most ${MAX_EXTRAS} extras` };
  const seen = new Set<string>();
  const extras: ProductExtra[] = [];
  for (const raw of input as Array<Partial<ProductExtra>>) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name) return { error: 'Each extra needs a name' };
    if (name.length > 60) return { error: `Extra "${name.slice(0, 20)}…": keep the name under 60 characters` };
    if (seen.has(name.toLowerCase())) return { error: `Extra "${name}" is listed twice` };
    seen.add(name.toLowerCase());
    const price = raw.price === undefined || raw.price === null || (raw.price as unknown) === '' ? 0 : Number(raw.price);
    if (!Number.isFinite(price) || price < 0) return { error: `Extra "${name}": price must be 0 or more` };
    const description = typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim().slice(0, 140) : undefined;
    extras.push({ name, price, ...(description ? { description } : {}) });
  }
  return { extras };
}
