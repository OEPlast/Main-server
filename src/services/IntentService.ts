import Intent, { IIntent } from '@/models/Intent';
import { CustomResponseType } from '@/types';

/**
 * Public reads for intent shops — consumed by the storefront to render
 * `/shop/<slug>` pages and to populate the sitemap.
 *
 * Only `active` intents are ever exposed: `draft` and `inactive` documents must
 * stay invisible to both users and crawlers.
 */

// Internal bookkeeping the storefront has no use for.
const PUBLIC_PROJECTION = '-__v -createdAt';

/** Enough for a product card; matches what the storefront grid renders. */
const PRODUCT_FIELDS = 'name slug price stock description_images images';

/**
 * `populate` preserves the stored array order — which IS the admin-defined
 * display order — but yields `null` for refs that no longer resolve, and for
 * products excluded by `match` (deleted or de-listed since curation). Those
 * holes must be stripped before the payload reaches the storefront.
 */
const POPULATE_ACTIVE_PRODUCTS = {
  path: 'products',
  match: { status: 'active' },
  select: PRODUCT_FIELDS,
};

function stripMissingProducts(intent: IIntent): IIntent {
  const products = ((intent.products || []) as unknown[]).filter(Boolean);
  return { ...intent, products } as IIntent;
}

class PublicIntentService {
  /**
   * All published intents with their curated products.
   * Powers `generateStaticParams` and the storefront sitemap.
   */
  async getActiveIntents(): Promise<CustomResponseType<IIntent[]>> {
    const intents = (await Intent.find({ status: 'active' })
      .select(PUBLIC_PROJECTION)
      .populate(POPULATE_ACTIVE_PRODUCTS)
      .sort({ updatedAt: -1 })
      .lean()) as IIntent[];

    return {
      code: 200,
      message: 'Intents fetched successfully',
      data: intents.map(stripMissingProducts),
    };
  }

  /**
   * Slugs only — a cheap call for sitemap generation.
   */
  async getActiveIntentSlugs(): Promise<CustomResponseType<Array<{ slug: string; updatedAt?: Date }>>> {
    const intents = await Intent.find({ status: 'active' })
      .select('slug updatedAt -_id')
      .sort({ updatedAt: -1 })
      .lean();

    return {
      code: 200,
      message: 'Intent slugs fetched successfully',
      data: intents as Array<{ slug: string; updatedAt?: Date }>,
    };
  }

  /**
   * A single published intent. Returns 404 for unknown, draft or inactive slugs
   * so the storefront renders a real not-found rather than an empty page.
   */
  async getIntentBySlug(slug: string): Promise<CustomResponseType<IIntent>> {
    const intent = (await Intent.findOne({ slug: slug.toLowerCase(), status: 'active' })
      .select(PUBLIC_PROJECTION)
      .populate(POPULATE_ACTIVE_PRODUCTS)
      .lean()) as IIntent | null;

    if (!intent) {
      return { code: 404, message: 'Intent not found', data: null };
    }

    return { code: 200, message: 'Intent fetched successfully', data: stripMissingProducts(intent) };
  }
}

export default new PublicIntentService();
