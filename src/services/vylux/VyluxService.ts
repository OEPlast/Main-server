import axios, { AxiosInstance } from 'axios';
import path from 'path';
import Product from '@/models/Product';
import Category from '@/models/Category';
import VyluxDraft from '@/models/VyluxDraft';
import Counter, { ensureSequenceAtLeast, nextSequence } from '@/models/Counter';
import FileUploadService from '@/services/FileUploadService';
import Admin_ProductService from '@/services/admin/Product';
import { logger } from '@/lib/logger';
import { CustomResponseType } from '@/types';

/**
 * Imports products from the Vylux scraper's store API (see the scraper's API.md).
 *
 * The scraper is only a source of names and pictures: an import copies the media into this
 * store's Bunny zone and creates an inactive product, and nothing is read back afterwards.
 * Off unless VYLUX_API_URL and VYLUX_API_KEY are set, so deployments without the scraper
 * (Rawura) never expose it.
 */

const PROVIDER = 'vylux';
const IMPORT_STOCK = 100;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // same limits as /files/upload
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMPORT_CONCURRENCY = 2;
// A small jewelry parcel, for GIG quotes until the product is edited.
const PARCEL = { weight: 0.2, length: 10, width: 10, height: 5 };

type VyluxPriceLine = { label: string; raw: string; min: number | null; max: number | null };
type VyluxMedia = {
  id: number;
  type: 'image' | 'video';
  url: string | null;
  posterUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  position: number;
  ready: boolean;
};
type VyluxProduct = {
  id: number;
  title: string;
  caption: string;
  prices: VyluxPriceLine[];
  postedAt: string | null;
  media: VyluxMedia[];
  telegram?: { url?: string };
};

export type VyluxListItem = {
  vyluxId: number;
  title: string;
  description: string;
  prices: VyluxPriceLine[];
  postedAt: string | null;
  media: { type: 'image' | 'video'; url: string; posterUrl: string | null }[];
  telegramUrl: string | null;
  importedProductId: string | null;
};

export type VyluxImportItem = {
  vyluxId: number;
  categoryId: string;
  price: number;
  name?: string;
  description?: string;
  /** Skip products whose post has no image instead of using a video thumbnail as the cover. */
  requireImage?: boolean;
  /**
   * `copy` (default) copies every file into this store's storage. `link` stores the scraper's own
   * CDN URLs instead: instant, but the pictures then depend on the scraper never deleting them.
   */
  media?: 'copy' | 'link';
  /** false: don't tell the scraper it was imported (test imports into a local database). */
  markImported?: boolean;
  /** Further product fields (tags, specifications, attributes, variants, extras, status…); `status` defaults to inactive. */
  fields?: Partial<Omit<Parameters<typeof Admin_ProductService.createProduct>[0], 'sku' | 'source' | 'description_images'>>;
};

export type VyluxImportResult = { vyluxId: number; ok: boolean; productId?: string; error?: string };

/** What the admin's "Add product" needs to open a prefilled product form. */
export type VyluxPrepared = {
  product: VyluxListItem;
  images: StoredImage[];
  /** Next free SKU, as a suggestion — the counter isn't consumed until a product is created. */
  suggestedSku: number;
};

const isConfigured = (): boolean => !!(process.env.VYLUX_API_URL?.trim() && process.env.VYLUX_API_KEY?.trim());

let client: AxiosInstance | null = null;
const api = (): AxiosInstance => {
  if (!client) {
    client = axios.create({
      baseURL: process.env.VYLUX_API_URL!.replace(/\/+$/, ''),
      timeout: 20_000,
      headers: { Authorization: `Bearer ${process.env.VYLUX_API_KEY}` },
    });
  }
  return client;
};

/** The caption without the lines that carry Vylux's own prices, so they never reach customers. */
export function stripPriceLines(caption: string, prices: VyluxPriceLine[]): string {
  const raws = prices.map((p) => p.raw.trim().toLowerCase()).filter(Boolean);
  return caption
    .split(/\r?\n/)
    .filter((line) => {
      const l = line.toLowerCase();
      return !raws.some((raw) => l.includes(raw));
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Ready media in store order: the first image (the cover), then the videos, then the other images. */
const readyMedia = (p: VyluxProduct) => {
  const ready = [...p.media].filter((m) => m.ready && m.url).sort((a, b) => a.position - b.position);
  const images = ready.filter((m) => m.type === 'image');
  const videos = ready.filter((m) => m.type === 'video');
  return images.length ? [images[0]!, ...videos, ...images.slice(1)] : videos;
};

const toListItem = (p: VyluxProduct, importedProductId: string | null): VyluxListItem => ({
  vyluxId: p.id,
  title: p.title,
  description: stripPriceLines(p.caption, p.prices) || p.title,
  prices: p.prices,
  postedAt: p.postedAt,
  media: readyMedia(p).map((m) => ({ type: m.type, url: m.url!, posterUrl: m.posterUrl })),
  telegramUrl: p.telegram?.url ?? null,
  importedProductId,
});

async function importedIds(vyluxIds: number[]): Promise<Map<string, string>> {
  const existing = await Product.find({ 'source.provider': PROVIDER, 'source.externalId': { $in: vyluxIds.map(String) } })
    .select('_id source.externalId')
    .lean();
  return new Map(existing.map((p) => [String(p.source?.externalId), String(p._id)]));
}

const listProducts = async (opts: {
  after?: number;
  limit?: number;
}): Promise<CustomResponseType<{ items: VyluxListItem[]; hasMore: boolean; nextAfter: number | null }>> => {
  if (!isConfigured()) return { message: 'Vylux import is not configured', data: null, code: 503 };
  try {
    const { data } = await api().get('/products', {
      params: { status: 'accepted', synced: 'false', limit: opts.limit ?? 50, after: opts.after },
    });
    const products: VyluxProduct[] = data.data ?? [];
    const imported = await importedIds(products.map((p) => p.id));
    return {
      message: 'Vylux products retrieved',
      data: {
        items: products.map((p) => toListItem(p, imported.get(String(p.id)) ?? null)),
        hasMore: !!data.hasMore,
        nextAfter: data.nextAfter ?? null,
      },
      code: 200,
    };
  } catch (error) {
    logger.error('[vylux] list failed', { error: (error as Error).message });
    return { message: 'Could not reach the Vylux scraper', data: null, code: 502 };
  }
};

let skuSeeded = false;
async function nextSku(): Promise<number> {
  if (!skuSeeded) {
    const highest = await Product.findOne().sort({ sku: -1 }).select('sku').lean();
    await ensureSequenceAtLeast('sku', Number(highest?.sku) || 0);
    skuSeeded = true;
  }
  return nextSequence('sku');
}

async function download(media: VyluxMedia): Promise<{ buffer: Buffer; mimetype: string; name: string }> {
  const max = media.type === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const res = await axios.get<ArrayBuffer>(media.url!, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    maxContentLength: max,
  });
  const buffer = Buffer.from(res.data);
  const mimetype =
    media.mimeType || String(res.headers['content-type'] || (media.type === 'video' ? 'video/mp4' : 'image/jpeg'));
  const name = path.basename(new URL(media.url!).pathname) || `${media.id}`;
  return { buffer, mimetype, name };
}

export type StoredImage = { url: string; cover_image: boolean; mediaType: 'image' | 'video'; miniUrl?: string };

type CopiedGroup = { url: string; miniUrl?: string; files: string[] };

/** @param groups receives, per copied file, every path stored for it (for VyluxDraft cleanup) */
async function copyMedia(product: VyluxProduct, uploadedPaths: string[], groups?: CopiedGroup[]): Promise<StoredImage[]> {
  const stored: StoredImage[] = [];
  for (const media of readyMedia(product)) {
    const file = await download(media);
    const res = await FileUploadService.uploadFile(
      {
        fieldname: 'file',
        originalname: file.name,
        encoding: '7bit',
        mimetype: file.mimetype,
        size: file.buffer.length,
        buffer: file.buffer,
      },
      'product',
      'vylux-import'
    );
    if (!res.data) throw new Error(`Media upload failed: ${res.message}`);
    const files = [res.data.path, res.data.miniPath, res.data.pngPath, res.data.thumbnailPath].filter((p): p is string => !!p);
    uploadedPaths.push(...files);
    groups?.push({ url: res.data.path, ...(res.data.thumbnailPath ? { miniUrl: res.data.thumbnailPath } : {}), files: [...new Set(files)] });
    stored.push(
      res.data.mediaType === 'video'
        ? { url: res.data.path, mediaType: 'video', miniUrl: res.data.thumbnailPath, cover_image: false }
        : { url: res.data.path, mediaType: 'image', cover_image: false }
    );
  }
  // The cover must be an image; a video-only post uses its first video's thumbnail.
  let cover = stored.find((m) => m.mediaType === 'image');
  if (!cover) {
    const thumb = stored.find((m) => m.mediaType === 'video' && m.miniUrl)?.miniUrl;
    if (!thumb) throw new Error('This product has no usable image');
    cover = { url: thumb, mediaType: 'image', cover_image: false };
    stored.unshift(cover);
  }
  cover.cover_image = true;
  return stored;
}

/** The scraper's own files, in store order, without copying; the first image is the cover. */
function linkMedia(product: VyluxProduct): StoredImage[] {
  const stored: StoredImage[] = readyMedia(product).map((m) =>
    m.type === 'video'
      ? { url: m.url!, mediaType: 'video', ...(m.posterUrl ? { miniUrl: m.posterUrl } : {}), cover_image: false }
      : { url: m.url!, mediaType: 'image', cover_image: false }
  );
  const cover = stored.find((m) => m.mediaType === 'image');
  if (!cover) throw new Error('This product has no usable image');
  cover.cover_image = true;
  return stored;
}

async function importOne(item: VyluxImportItem): Promise<VyluxImportResult> {
  const vyluxId = item.vyluxId;
  if ((await importedIds([vyluxId])).has(String(vyluxId))) {
    return { vyluxId, ok: false, error: 'Already imported' };
  }

  const uploadedPaths: string[] = [];
  try {
    const { data } = await api().get(`/products/${vyluxId}`);
    const product: VyluxProduct = data.data;
    if (item.requireImage && !readyMedia(product).some((m) => m.type === 'image')) {
      return { vyluxId, ok: false, error: 'Video-only product skipped' };
    }
    const images = item.media === 'link' ? linkMedia(product) : await copyMedia(product, uploadedPaths);
    const name = item.name?.trim() || product.title;
    const description = item.description?.trim() || stripPriceLines(product.caption, product.prices) || name;

    const created = await Admin_ProductService.createProduct({
      ...PARCEL,
      ...item.fields,
      sku: await nextSku(),
      name,
      description,
      price: item.price,
      category: item.categoryId,
      description_images: images,
      stock: item.fields?.stock ?? IMPORT_STOCK,
      status: item.fields?.status ?? 'inactive',
      condition: 'new',
      source: { provider: PROVIDER, externalId: String(vyluxId), importedAt: new Date() },
    });
    if (!created.data) throw new Error(created.message);
    const productId = String((created.data as unknown as { _id: unknown })._id);

    // Only hides it from the scraper's "not synced" list; the unique index already stops a second import.
    if (item.markImported !== false) api()
      .patch(`/products/${vyluxId}`, { storeProductId: productId })
      .catch((error) => logger.warn(`[vylux] could not mark ${vyluxId} as imported: ${(error as Error).message}`));

    return { vyluxId, ok: true, productId };
  } catch (error) {
    await Promise.all(uploadedPaths.map((p) => FileUploadService.deleteFile(p).catch(() => undefined)));
    const message = axios.isAxiosError(error)
      ? error.response?.status === 404
        ? 'Not found on the Vylux scraper'
        : `Vylux request failed: ${error.message}`
      : (error as Error).message;
    logger.error(`[vylux] import ${vyluxId} failed: ${message}`);
    return { vyluxId, ok: false, error: message };
  }
}

const importProducts = async (items: VyluxImportItem[]): Promise<CustomResponseType<VyluxImportResult[]>> => {
  if (!isConfigured()) return { message: 'Vylux import is not configured', data: null, code: 503 };

  const categoryIds = [...new Set(items.map((i) => i.categoryId))];
  const found = await Category.find({ _id: { $in: categoryIds } }).select('_id').lean();
  if (found.length !== categoryIds.length) return { message: 'One or more categories do not exist', data: null, code: 400 };

  const results: VyluxImportResult[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await importOne(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(IMPORT_CONCURRENCY, items.length) }, worker));

  const imported = results.filter((r) => r.ok).length;
  return { message: `Imported ${imported} of ${items.length}`, data: results, code: 200 };
};

/** Highest of the SKU counter and the largest SKU in use, plus one. Read-only. */
async function peekNextSku(): Promise<number> {
  const [highest, counter] = await Promise.all([
    Product.findOne().sort({ sku: -1 }).select('sku').lean(),
    Counter.findById('sku').lean(),
  ]);
  return Math.max(Number(highest?.sku) || 0, counter?.seq ?? 0) + 1;
}

/**
 * "Add product": copies one scraper product's media into this store's storage and returns it
 * with the scraper's title, caption and price lines, so the admin can open the normal product
 * form already holding the pictures. Nothing is created yet; the product form does that, with
 * `vyluxId` so the product is linked back (see linkProductSource / markImported).
 */
const prepareProduct = async (vyluxId: number): Promise<CustomResponseType<VyluxPrepared>> => {
  if (!isConfigured()) return { message: 'Vylux import is not configured', data: null, code: 503 };
  const existing = (await importedIds([vyluxId])).get(String(vyluxId));
  if (existing) return { message: 'Already imported', data: null, code: 409 };

  const uploadedPaths: string[] = [];
  try {
    const { data } = await api().get(`/products/${vyluxId}`);
    const product: VyluxProduct = data.data;
    const groups: CopiedGroup[] = [];
    const images = await copyMedia(product, uploadedPaths, groups);
    // Remembered so pictures from an abandoned form (or removed from it) can be cleaned up later.
    await VyluxDraft.create({ vyluxId, media: groups });
    return {
      message: 'Vylux product ready',
      data: { product: toListItem(product, null), images, suggestedSku: await peekNextSku() },
      code: 200,
    };
  } catch (error) {
    await Promise.all(uploadedPaths.map((p) => FileUploadService.deleteFile(p).catch(() => undefined)));
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) return { message: 'Not found on the Vylux scraper', data: null, code: 404 };
      logger.error(`[vylux] prepare ${vyluxId} failed: ${error.message}`);
      return { message: 'Could not reach the Vylux scraper', data: null, code: 502 };
    }
    logger.error(`[vylux] prepare ${vyluxId} failed: ${(error as Error).message}`);
    return { message: (error as Error).message, data: null, code: 500 };
  }
};

/** The `source` stored on a product created from a scraper product; null when import is off. */
const productSource = (vyluxId: number) =>
  isConfigured() ? { provider: PROVIDER, externalId: String(vyluxId), importedAt: new Date() } : null;

/** True when a product already exists for this scraper product. */
const isImported = async (vyluxId: number) => (await importedIds([vyluxId])).has(String(vyluxId));

/** Hides the scraper product from the "not synced" list. Fire and forget. */
const markImported = (vyluxId: number, productId: string) => {
  if (!isConfigured()) return;
  api()
    .patch(`/products/${vyluxId}`, { storeProductId: productId })
    .catch((error) => logger.warn(`[vylux] could not mark ${vyluxId} as imported: ${(error as Error).message}`));
};

/**
 * Deletes pictures copied by "Add product" more than `olderThanMs` ago that no product uses
 * (abandoned forms, pictures removed in the form), then forgets those drafts.
 */
const cleanupDrafts = async (olderThanMs: number, batch = 100): Promise<{ drafts: number; deletedFiles: number }> => {
  const drafts = await VyluxDraft.find({ createdAt: { $lt: new Date(Date.now() - olderThanMs) } })
    .sort({ createdAt: 1 })
    .limit(batch)
    .lean();
  if (!drafts.length) return { drafts: 0, deletedFiles: 0 };

  const paths = drafts.flatMap((d) => d.media.flatMap((m) => [m.url, m.miniUrl].filter((p): p is string => !!p)));
  const used = await Product.find({
    $or: [
      { 'description_images.url': { $in: paths } },
      { 'description_images.miniUrl': { $in: paths } },
      { 'attributes.children.images': { $in: paths } },
    ],
  })
    .select('description_images attributes')
    .lean();
  const inUse = new Set<string>();
  for (const p of used as Array<{ description_images?: { url?: string; miniUrl?: string }[]; attributes?: { children?: { images?: string[] }[] }[] }>) {
    for (const img of p.description_images ?? []) [img.url, img.miniUrl].forEach((u) => u && inUse.add(u));
    for (const a of p.attributes ?? []) for (const c of a.children ?? []) for (const i of c.images ?? []) inUse.add(i);
  }

  let deletedFiles = 0;
  for (const draft of drafts) {
    for (const media of draft.media) {
      if (inUse.has(media.url) || (media.miniUrl && inUse.has(media.miniUrl))) continue;
      for (const file of media.files) {
        const res = await FileUploadService.deleteFile(file).catch(() => null);
        if (res?.code === 200) deletedFiles += 1;
      }
    }
  }
  await VyluxDraft.deleteMany({ _id: { $in: drafts.map((d) => d._id) } });
  return { drafts: drafts.length, deletedFiles };
};

const VyluxService = { isConfigured, listProducts, importProducts, prepareProduct, productSource, isImported, markImported, cleanupDrafts };
export default VyluxService;
