import axios, { AxiosRequestConfig } from 'axios';
import { GoogleAuth } from 'google-auth-library';
import Product from '../models/Product';
import { getGoogleProductCategory } from '../config/googleProductCategories';
import { getBrand } from './email/brand';

/**
 * MerchantApiService
 *
 * Direct integration with the Google Merchant API (the successor to the Content
 * API for Shopping). Covers the four workflows:
 *   1. Add / manage products      → productInputs.insert / productInputs.delete
 *      https://developers.google.com/merchant/api/guides/products/add-manage
 *   2. Frequent updates           → re-insert changed products (price/availability)
 *      https://developers.google.com/merchant/api/guides/products/frequent-updates
 *   3. List product data issues   → products.list → itemLevelIssues
 *      https://developers.google.com/merchant/api/guides/products/list-products-data-issues
 *   4. Monitor data source status → dataSources.list + fileUploads status
 *      https://developers.google.com/merchant/api/guides/data-sources/monitor-status
 *
 * Auth: a Google service account with access to the Merchant Center account,
 * scope https://www.googleapis.com/auth/content. Credentials come from either
 * GOOGLE_APPLICATION_CREDENTIALS (path) or GOOGLE_SERVICE_ACCOUNT_JSON (inline).
 *
 * Everything is gated by isConfigured() so the app runs fine without credentials.
 */

const ACCOUNT_ID = process.env.GOOGLE_MERCHANT_ACCOUNT_ID || '';
// Primary product data source resource id (the API-managed data source).
const DATA_SOURCE = process.env.GOOGLE_MERCHANT_DATA_SOURCE || '';
const STORE_URL =
  process.env.STOREFRONT_URL || process.env.FRONTEND_URL || 'https://www.rawura.com';
const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://oeptest.b-cdn.net/';
const CURRENCY = 'NGN';
const COUNTRY = 'NG';
const FEED_LABEL = process.env.GOOGLE_MERCHANT_FEED_LABEL || 'NG';
const CONTENT_LANGUAGE = 'en';

const PRODUCTS_BASE = 'https://merchantapi.googleapis.com/products/v1beta';
const DATASOURCES_BASE = 'https://merchantapi.googleapis.com/datasources/v1beta';
const SCOPE = 'https://www.googleapis.com/auth/content';

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

function toAbsoluteImage(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${CDN_BASE_URL}${clean}`;
}

function cleanDescription(desc?: string): string {
  if (!desc) return '';
  return desc
    .replace(/[#*_`>~]/g, '')
    .replace(/\!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4900);
}

function priceMicros(amount: number) {
  return { amountMicros: String(Math.round(amount * 1_000_000)), currencyCode: CURRENCY };
}

class MerchantApiService {
  private auth: GoogleAuth | null = null;

  /** Whether Merchant API credentials + IDs are configured. */
  isConfigured(): boolean {
    const hasCreds =
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS || !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    return !!ACCOUNT_ID && !!DATA_SOURCE && hasCreds;
  }

  private getAuth(): GoogleAuth {
    if (this.auth) return this.auth;
    const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    this.auth = new GoogleAuth({
      scopes: [SCOPE],
      ...(inlineJson ? { credentials: JSON.parse(inlineJson) } : {}),
    });
    return this.auth;
  }

  private async request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    const client = await this.getAuth().getClient();
    const token = await client.getAccessToken();
    const res = await axios.request<T>({
      ...config,
      headers: {
        Authorization: `Bearer ${token.token}`,
        'Content-Type': 'application/json',
        ...(config.headers || {}),
      },
    });
    return res.data;
  }

  private accountPath(): string {
    // Accept either a bare numeric id or a full "accounts/123" value.
    return ACCOUNT_ID.startsWith('accounts/') ? ACCOUNT_ID : `accounts/${ACCOUNT_ID}`;
  }

  private dataSourcePath(): string {
    return DATA_SOURCE.startsWith('accounts/')
      ? DATA_SOURCE
      : `${this.accountPath()}/dataSources/${DATA_SOURCE}`;
  }

  /** Build the Merchant API ProductInput resource from a Product document. */
  private mapProductToInput(p: FeedProduct, storeName: string) {
    const images = (p.description_images || []).filter((i) => i.mediaType !== 'video');
    const cover = images.find((i) => i.cover_image) || images[0];
    const additionalImageLinks = images
      .filter((i) => i !== cover)
      .slice(0, 10)
      .map((i) => toAbsoluteImage(i.url))
      .filter(Boolean);

    const hasIdentifier = !!(p.gtin || p.mpn || p.brand);
    const gpc = getGoogleProductCategory(p.category?.slug, p.category?.name);

    const attributes: Record<string, unknown> = {
      title: p.name,
      description: cleanDescription(p.description) || p.name,
      link: `${STORE_URL}/product/${p.slug}`,
      imageLink: toAbsoluteImage(cover?.url),
      availability: p.stock > 0 ? 'in_stock' : 'out_of_stock',
      price: priceMicros(p.price),
      condition: p.condition || 'new',
      brand: p.brand || storeName,
      identifierExists: hasIdentifier,
      shipping: [{ country: COUNTRY, price: priceMicros(0) }],
    };
    if (additionalImageLinks.length) attributes.additionalImageLinks = additionalImageLinks;
    if (p.gtin) attributes.gtin = p.gtin;
    if (p.mpn) attributes.mpn = p.mpn;
    if (p.category?.name) attributes.productTypes = [p.category.name];
    if (gpc) attributes.googleProductCategory = gpc;

    return {
      offerId: String(p.sku ?? p._id),
      contentLanguage: CONTENT_LANGUAGE,
      feedLabel: FEED_LABEL,
      attributes,
    };
  }

  /**
   * (1)(2) Insert/update a single product (also used for frequent updates —
   * re-inserting a changed product refreshes price/availability).
   */
  async upsertProduct(product: FeedProduct): Promise<unknown> {
    const brand = await getBrand();
    const input = this.mapProductToInput(product, brand.storeName);
    const url = `${PRODUCTS_BASE}/${this.accountPath()}/productInputs:insert?dataSource=${encodeURIComponent(
      this.dataSourcePath()
    )}`;
    return this.request({ method: 'POST', url, data: input });
  }

  /** (1) Delete a product input by offerId. */
  async deleteProduct(offerId: string): Promise<void> {
    // Product input name: accounts/{acct}/productInputs/{channel}~{lang}~{feedLabel}~{offerId}
    const name = `${this.accountPath()}/productInputs/online~${CONTENT_LANGUAGE}~${FEED_LABEL}~${offerId}`;
    const url = `${PRODUCTS_BASE}/${name}?dataSource=${encodeURIComponent(this.dataSourcePath())}`;
    await this.request({ method: 'DELETE', url });
  }

  /**
   * (1)(2) Full catalogue sync — upsert every active product. Runs with bounded
   * concurrency so we do not hammer the API. Returns a per-product result summary.
   */
  async syncAllProducts(
    concurrency = 5
  ): Promise<{ total: number; succeeded: number; failed: number; errors: string[] }> {
    const products = (await Product.find({ status: 'active' })
      .populate('category', 'name slug')
      .select('sku name slug description price stock brand gtin mpn condition description_images category')
      .lean()
      .exec()) as unknown as FeedProduct[];

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < products.length; i += concurrency) {
      const batch = products.slice(i, i + concurrency);
      const results = await Promise.allSettled(batch.map((p) => this.upsertProduct(p)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          succeeded++;
        } else {
          failed++;
          if (errors.length < 25) {
            errors.push(`${batch[j].slug}: ${r.reason?.message || 'unknown error'}`);
          }
        }
      }
    }

    return { total: products.length, succeeded, failed, errors };
  }

  /**
   * (3) List processed products with their item-level data issues so we can
   * surface disapprovals/warnings that hurt Shopping visibility.
   */
  async listProductIssues(pageSize = 250): Promise<
    Array<{ offerId?: string; title?: string; issues: unknown[] }>
  > {
    const url = `${PRODUCTS_BASE}/${this.accountPath()}/products?pageSize=${pageSize}`;
    const data = await this.request<{ products?: Array<Record<string, any>> }>({
      method: 'GET',
      url,
    });
    const products = data.products || [];
    return products
      .map((prod) => {
        const status = prod.productStatus || {};
        const issues = status.itemLevelIssues || [];
        return {
          offerId: prod.offerId,
          title: prod.attributes?.title,
          issues,
        };
      })
      .filter((p) => p.issues.length > 0);
  }

  /**
   * (4) Monitor data source status — list data sources and, for the primary
   * product source, the latest file-upload processing status.
   */
  async getDataSourcesStatus(): Promise<unknown> {
    const listUrl = `${DATASOURCES_BASE}/${this.accountPath()}/dataSources`;
    const list = await this.request<{ dataSources?: Array<Record<string, any>> }>({
      method: 'GET',
      url: listUrl,
    });

    // Best-effort: fetch latest file-upload status for the configured data source.
    let latestFileUpload: unknown = null;
    try {
      const fuUrl = `${DATASOURCES_BASE}/${this.dataSourcePath()}/fileUploads/latest`;
      latestFileUpload = await this.request({ method: 'GET', url: fuUrl });
    } catch (e) {
      latestFileUpload = { error: e instanceof Error ? e.message : 'unavailable' };
    }

    return { dataSources: list.dataSources || [], latestFileUpload };
  }
}

export default new MerchantApiService();
