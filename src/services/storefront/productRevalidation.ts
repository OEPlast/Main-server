/**
 * Turns "these products changed" into storefront cache tags.
 *
 * Two things make this less trivial than it looks:
 *
 *  - Callers usually hold ids, not slugs, and the storefront caches by slug. So we look them up.
 *  - A product's *old* slugs still resolve: `/product/<old-slug>` 301s to the current URL, and the
 *    storefront caches that redirect lookup under the old slug's tag. Renaming without purging
 *    `slugHistory` would leave the old URL pointing at a stale destination.
 *
 * `lists: true` also purges the `products` tag, which covers the home rails, `/deals` and every
 * category and campaign listing. That is a large blast radius, so it is opt-in: a price or name
 * change deserves it, a stock decrement on every order does not.
 */
import { Types } from 'mongoose';
import Product from '@/models/Product';
import { campaignTag, productTag, requestStorefrontRevalidation, StorefrontTag } from './revalidate';

type Id = string | Types.ObjectId | null | undefined;

interface Options {
  /** Also purge every product *list* (home rails, deals, category and campaign listings). */
  lists?: boolean;
  /** Extra tags to send in the same batch, e.g. a campaign the product belongs to. */
  extraTags?: Array<string | null | undefined>;
}

const tagsFor = (slug?: string | null, slugHistory?: string[] | null): string[] => {
  const tags: string[] = [];
  if (slug) tags.push(productTag(slug));
  for (const old of slugHistory ?? []) if (old) tags.push(productTag(old));
  return tags;
};

/** When the caller already has the document (or at least its slug fields). */
export function revalidateProductDocs(
  products: Array<{ slug?: string | null; slugHistory?: string[] | null; } | null | undefined>,
  options: Options = {}
): void {
  const tags = products.flatMap((p) => (p ? tagsFor(p.slug, p.slugHistory) : []));
  if (options.lists) tags.push(StorefrontTag.PRODUCTS);
  requestStorefrontRevalidation([...tags, ...(options.extraTags ?? [])]);
}

/**
 * When the caller only has ids. Fire-and-forget: it swallows its own errors, because a failed
 * lookup must never turn into a failed write.
 */
export async function revalidateProducts(ids: Id[], options: Options = {}): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) {
    if (options.lists || options.extraTags?.length) {
      requestStorefrontRevalidation([
        ...(options.lists ? [StorefrontTag.PRODUCTS] : []),
        ...(options.extraTags ?? []),
      ]);
    }
    return;
  }
  try {
    const products = await Product.find({ _id: { $in: unique } })
      .select('slug slugHistory')
      .lean();
    revalidateProductDocs(products as Array<{ slug?: string; slugHistory?: string[]; }>, options);
  } catch (error) {
    console.warn('[revalidate] could not resolve product slugs:', (error as Error).message);
    // Still purge the lists we were asked to; only the per-product tags are lost.
    if (options.lists || options.extraTags?.length) {
      requestStorefrontRevalidation([
        ...(options.lists ? [StorefrontTag.PRODUCTS] : []),
        ...(options.extraTags ?? []),
      ]);
    }
  }
}

/**
 * A sale changed (created, edited, deactivated, deleted, or its unit cap moved). That changes the
 * product's own page, every list it appears in — the deals page is built from live sales — and, if
 * the sale belongs to a campaign, that campaign's page.
 *
 * Fire-and-forget, like the rest of this module.
 */
export async function revalidateSale(
  sale: { product?: Id; campaign?: Id; } | null | undefined
): Promise<void> {
  if (!sale) return;
  const extraTags: string[] = [];
  try {
    if (sale.campaign) {
      // Imported lazily: Campaign pulls in its own model graph, and this path runs rarely.
      const { default: Campaign } = await import('@/models/Campaign');
      const campaign = await Campaign.findById(sale.campaign).select('slug').lean<{ slug?: string; }>();
      if (campaign?.slug) extraTags.push(campaignTag(campaign.slug), StorefrontTag.CAMPAIGNS);
    }
  } catch (error) {
    console.warn('[revalidate] could not resolve campaign slug:', (error as Error).message);
  }
  await revalidateProducts([sale.product], { lists: true, extraTags });
}
