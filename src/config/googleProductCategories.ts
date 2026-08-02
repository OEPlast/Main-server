/**
 * Maps Rawura category slugs (or names) → Google product category taxonomy path.
 *
 * Full taxonomy: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
 * Google accepts either the numeric ID or the full ">"-delimited path (used here).
 *
 * Unmapped categories are omitted from the feed → Merchant Center auto-classifies
 * as a fallback. Expand this map as real categories are added (keys are lowercased
 * category slugs; names are also matched as a convenience).
 */
export const GOOGLE_PRODUCT_CATEGORY: Record<string, string> = {
  // Seed examples — replace/extend with the store's real category slugs.
  electronics: 'Electronics',
  phones: 'Electronics > Communications > Telephony > Mobile Phones',
  'mobile-phones': 'Electronics > Communications > Telephony > Mobile Phones',
  laptops: 'Electronics > Computers > Laptops',
  computers: 'Electronics > Computers',
  furniture: 'Furniture',
  'office-chairs': 'Furniture > Chairs > Office Chairs',
  chairs: 'Furniture > Chairs',
  fashion: 'Apparel & Accessories',
  clothing: 'Apparel & Accessories > Clothing',
  shoes: 'Apparel & Accessories > Shoes',
  bags: 'Apparel & Accessories > Handbags, Wallets & Cases',
  'home-kitchen': 'Home & Garden > Kitchen & Dining',
  home: 'Home & Garden',
  kitchen: 'Home & Garden > Kitchen & Dining',
  beauty: 'Health & Beauty > Personal Care',
  health: 'Health & Beauty',
  toys: 'Toys & Games',
  baby: 'Baby & Toddler',
  groceries: 'Food, Beverages & Tobacco',
};

export function getGoogleProductCategory(slug?: string, name?: string): string | undefined {
  if (slug) {
    const bySlug = GOOGLE_PRODUCT_CATEGORY[slug.toLowerCase()];
    if (bySlug) return bySlug;
  }
  if (name) {
    const byName = GOOGLE_PRODUCT_CATEGORY[name.toLowerCase()];
    if (byName) return byName;
  }
  return undefined;
}
