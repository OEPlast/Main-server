/**
 * Free delivery over the threshold, for every delivery method (owner decision, 2026-09-15). The
 * storefront advertises "free delivery over ₦X" in the cart, top bar and policy pages; before
 * this, only the flat-rate method honoured it, and the live store only offers GIG and pickup.
 *
 * A threshold of null means no offer; 0 means every order ships free (existing admin semantics).
 * The threshold is compared with the items subtotal after sales and tiers, before coupons, the
 * same figure the cart's free-delivery progress bar uses.
 */
import { roundKobo } from './linePricing';

export function qualifiesForFreeDelivery(itemsSubtotal: number, threshold: number | null | undefined): boolean {
  return typeof threshold === 'number' && Number.isFinite(threshold) && threshold >= 0 && itemsSubtotal >= threshold;
}

export function applyFreeDelivery(
  deliveryCost: number,
  itemsSubtotal: number,
  threshold: number | null | undefined
): { amount: number; freeDeliveryApplied: boolean } {
  const free = qualifiesForFreeDelivery(itemsSubtotal, threshold);
  return { amount: free ? 0 : roundKobo(Math.max(0, deliveryCost)), freeDeliveryApplied: free };
}
