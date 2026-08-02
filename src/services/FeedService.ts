import Product from '../models/Product';
import { getGoogleProductCategory } from '../config/googleProductCategories';

/**
 * FeedService
 * Generates a Google Merchant Center compliant product feed (RSS 2.0 + g:
 * namespace) so every active product can appear in Google's free product
 * listings and the Shopping tab.
 *
 * Notes:
 * - Prices/availability MUST match the on-page Product schema exactly (mismatch
 *   → Merchant Center disapproval). Both derive from the same Product fields.
 * - Free shipping nationwide + 7-day returns are declared to match store policy.
 * - GTIN/MPN/brand improve match quality; when none exist we set
 *   identifier_exists=no (required by Google in that case).
 */

const STORE_URL =
  process.env.STOREFRONT_URL || process.env.FRONTEND_URL || 'https://www.rawura.com';
const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://oeptest.b-cdn.net/';
const CURRENCY = 'NGN';
const COUNTRY = 'NG';

function xmlEscape(input: unknown): string {
  const s = String(input ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteImage(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${CDN_BASE_URL}${clean}`;
}

function cleanDescription(desc?: string): string {
  if (!desc) return '';
  // Light markdown strip; Google allows plain text up to 5000 chars.
  return desc
    .replace(/[#*_`>~]/g, '')
    .replace(/\!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4900);
}

interface FeedProduct {
  _id: unknown;
  sku?: number;
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  brand?: string;
  gtin?: string;
  mpn?: string;
  condition?: string;
  description_images?: Array<{ url: string; cover_image?: boolean; mediaType?: string }>;
  category?: { name?: string; slug?: string } | null;
}

class FeedService {
  private itemXml(p: FeedProduct): string {
    const images = (p.description_images || []).filter((i) => i.mediaType !== 'video');
    const cover = images.find((i) => i.cover_image) || images[0];
    const imageLink = toAbsoluteImage(cover?.url);
    const additional = images
      .filter((i) => i !== cover)
      .slice(0, 10)
      .map((i) => `    <g:additional_image_link>${xmlEscape(toAbsoluteImage(i.url))}</g:additional_image_link>`)
      .join('\n');

    const availability = p.stock > 0 ? 'in_stock' : 'out_of_stock';
    const hasIdentifier = !!(p.gtin || p.mpn || p.brand);

    const lines: string[] = [
      '  <item>',
      `    <g:id>${xmlEscape(p.sku ?? p._id)}</g:id>`,
      `    <g:title>${xmlEscape(p.name)}</g:title>`,
      `    <g:description>${xmlEscape(cleanDescription(p.description) || p.name)}</g:description>`,
      `    <g:link>${xmlEscape(`${STORE_URL}/product/${p.slug}`)}</g:link>`,
      imageLink ? `    <g:image_link>${xmlEscape(imageLink)}</g:image_link>` : '',
      additional,
      `    <g:availability>${availability}</g:availability>`,
      `    <g:price>${p.price.toFixed(2)} ${CURRENCY}</g:price>`,
      `    <g:condition>${xmlEscape(p.condition || 'new')}</g:condition>`,
      `    <g:brand>${xmlEscape(p.brand || 'Rawura')}</g:brand>`,
      p.gtin ? `    <g:gtin>${xmlEscape(p.gtin)}</g:gtin>` : '',
      p.mpn ? `    <g:mpn>${xmlEscape(p.mpn)}</g:mpn>` : '',
      `    <g:identifier_exists>${hasIdentifier ? 'yes' : 'no'}</g:identifier_exists>`,
      p.category?.name ? `    <g:product_type>${xmlEscape(p.category.name)}</g:product_type>` : '',
      (() => {
        const gpc = getGoogleProductCategory(p.category?.slug, p.category?.name);
        return gpc ? `    <g:google_product_category>${xmlEscape(gpc)}</g:google_product_category>` : '';
      })(),
      // Free shipping nationwide (matches store policy + on-page schema).
      '    <g:shipping>',
      `      <g:country>${COUNTRY}</g:country>`,
      `      <g:price>0.00 ${CURRENCY}</g:price>`,
      '    </g:shipping>',
      '  </item>',
    ];

    return lines.filter(Boolean).join('\n');
  }

  /**
   * Build the full product feed XML string.
   */
  async generateProductFeed(): Promise<string> {
    const products = (await Product.find({ status: 'active' })
      .populate('category', 'name slug')
      .select('sku name slug description price stock brand gtin mpn condition description_images category')
      .lean()
      .exec()) as unknown as FeedProduct[];

    const items = products.map((p) => this.itemXml(p)).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Rawura Product Feed</title>
  <link>${xmlEscape(STORE_URL)}</link>
  <description>Rawura product feed for Google Merchant Center</description>
${items}
</channel>
</rss>`;
  }
}

export default new FeedService();
