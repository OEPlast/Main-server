import type { StoreBrand } from './types';

/*
 * Storefront link builders.
 *
 * Moved here from `@rawura/emails` (v1.0.1 `src/branding.ts`). Centralised because every one
 * of these was previously hand-built at the call site, and every one of them was wrong: order
 * links pointed at `/orders/:id`, which is not a route on the storefront (the real one is
 * `/my-account/orders/:id`), and two of them hardcoded a different company's domain entirely.
 */

export function orderUrl(brand: StoreBrand, orderId: string): string {
  return `${brand.storefrontUrl}/my-account/orders/${orderId}`;
}

/**
 * The public tracking page, pre-filled with the order number. The customer confirms with their
 * email there (it is never put in the URL). This used to pass the Mongo id as `?order=`, which the
 * page did not read, so every "track your order" button opened an empty form.
 */
export function orderTrackingUrl(brand: StoreBrand, orderNumber: string): string {
  return `${brand.storefrontUrl}/order-tracking?order=${encodeURIComponent(orderNumber)}`;
}

export function productUrl(brand: StoreBrand, slug: string): string {
  return `${brand.storefrontUrl}/product/${slug}`;
}

/** Deep link that opens a product page with its review form focused. */
export function productReviewUrl(brand: StoreBrand, slug: string): string {
  return `${brand.storefrontUrl}/product/${slug}?review=1#reviews`;
}

/** "Start shopping" / "Continue shopping". `/shop` is not a storefront route; the home page is. */
export function shopUrl(brand: StoreBrand): string {
  return `${brand.storefrontUrl}/`;
}

export function cartUrl(brand: StoreBrand): string {
  return `${brand.storefrontUrl}/cart`;
}

export function accountUrl(brand: StoreBrand): string {
  return `${brand.storefrontUrl}/my-account`;
}

export function returnsUrl(brand: StoreBrand, orderId: string): string {
  return `${brand.storefrontUrl}/my-account/orders/${orderId}?tab=returns`;
}

/** The storefront contact page. This pointed at `/pages/contact-us`, which does not exist. */
export function supportUrl(brand: StoreBrand): string {
  return `${brand.storefrontUrl}/pages/contact`;
}
