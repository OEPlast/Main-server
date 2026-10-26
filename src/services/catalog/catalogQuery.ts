import mongoose, { PipelineStage, Types } from 'mongoose';
import Category from '@/models/Category';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { collectionConditions } from './collections';
import { backInStockCutoff, backInStockDays } from './restock';

/**
 * Storefront catalog helpers shared by the product list, its filter facets, the category tree and
 * product badges: category-slug scoping (including subcategories), curated collections, lists by
 * id, specification filters, and the "new" / "best seller" flags.
 */

export type BuiltInCollection = 'best-sellers' | 'new-arrivals' | 'latest-drops' | 'back-in-stock';
export const COLLECTIONS: BuiltInCollection[] = ['best-sellers', 'new-arrivals', 'latest-drops'];
/** Built-ins plus admin collections (StoreCollection slugs). */
export type Collection = BuiltInCollection | (string & {});

/** The built-in collections this deployment offers (back-in-stock only with BACK_IN_STOCK_DAYS). */
export const builtInCollections = (): BuiltInCollection[] => (backInStockDays() ? [...COLLECTIONS, 'back-in-stock'] : COLLECTIONS);

export type CatalogScope = {
  /** Category slug; includes every subcategory below it. */
  category?: string;
  collection?: Collection;
  /** Product ids, e.g. a guest's wishlist. */
  ids?: string[];
  /** Specification filters, e.g. { Material: ['925 Sterling Silver'] }. */
  specs?: Record<string, string[]>;
  /** Free-text search; a search still finds add-on products (see below). */
  query?: string;
};

const DEFAULT_NEW_ARRIVAL_DAYS = 30;
const DEFAULT_BEST_SELLER_COUNT = 20;
const SETTINGS_TTL_MS = 60_000;
const BEST_SELLERS_TTL_MS = 10 * 60_000;

type CatalogSettings = { newArrivalDays: number; bestSellerCount: number; bestSellerPicks: Types.ObjectId[] };
let settingsCache: (CatalogSettings & { at: number }) | null = null;

export async function getCatalogSettings(): Promise<CatalogSettings> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache;
  const s = await Settings.findOne().select('newArrivalDays bestSellerCount bestSellerPicks').lean<{
    newArrivalDays?: number;
    bestSellerCount?: number;
    bestSellerPicks?: Types.ObjectId[];
  }>();
  settingsCache = {
    at: Date.now(),
    newArrivalDays: s?.newArrivalDays || DEFAULT_NEW_ARRIVAL_DAYS,
    bestSellerCount: s?.bestSellerCount || DEFAULT_BEST_SELLER_COUNT,
    bestSellerPicks: s?.bestSellerPicks ?? [],
  };
  return settingsCache;
}

export const newArrivalCutoff = (days: number) => new Date(Date.now() - days * 86_400_000);

let bestSellerCache: { at: number; ids: Types.ObjectId[] } | null = null;

/** Products ranked by units sold on paid, non-cancelled orders (most sold first). */
export async function getRankedBestSellers(): Promise<Types.ObjectId[]> {
  if (bestSellerCache && Date.now() - bestSellerCache.at < BEST_SELLERS_TTL_MS) return bestSellerCache.ids;
  const rows = await Order.aggregate<{ _id: Types.ObjectId }>([
    { $match: { isPaid: true, status: { $in: ['Processing', 'Completed'] } } },
    { $unwind: '$products' },
    { $group: { _id: '$products.product', sold: { $sum: '$products.qty' } } },
    // Only products that still exist and are live: a deleted one would hold a slot and show nothing.
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', pipeline: [{ $project: { status: 1 } }], as: 'product' } },
    { $match: { 'product.status': 'active' } },
    { $sort: { sold: -1, _id: 1 } },
    { $limit: 500 },
  ]);
  bestSellerCache = { at: Date.now(), ids: rows.map((r) => r._id) };
  return bestSellerCache.ids;
}

/** Top sellers by units sold, then the store's picks (in their order) to fill any empty slots. */
export async function getBestSellerIds(): Promise<Types.ObjectId[]> {
  const [ranked, { bestSellerCount, bestSellerPicks }] = await Promise.all([getRankedBestSellers(), getCatalogSettings()]);
  const ids = ranked.slice(0, bestSellerCount);
  const taken = new Set(ids.map(String));
  for (const pick of bestSellerPicks) {
    if (ids.length >= bestSellerCount) break;
    if (!taken.has(String(pick))) {
      ids.push(pick);
      taken.add(String(pick));
    }
  }
  return ids;
}

/** The category with this slug and every category below it, or null when the slug is unknown. */
export async function categoryIdsForSlug(slug: string): Promise<Types.ObjectId[] | null> {
  const root = await Category.findOne({ slug: slug.toLowerCase() }).select('_id').lean();
  if (!root) return null;
  const ids: Types.ObjectId[] = [root._id as Types.ObjectId];
  let frontier = [root._id];
  // Categories can have several parents, so guard against cycles.
  for (let depth = 0; depth < 5 && frontier.length; depth++) {
    const children = await Category.find({ parent: { $in: frontier }, _id: { $nin: ids } })
      .select('_id')
      .lean();
    frontier = children.map((c) => c._id);
    ids.push(...(frontier as Types.ObjectId[]));
  }
  return ids;
}

/** Parses "Key:Value1|Value2" (one string or several) into { Key: [Value1, Value2] }. */
export function parseKeyValues(param: unknown): Record<string, string[]> | undefined {
  if (param == null) return undefined;
  const entries = Array.isArray(param) ? param : [param];
  const out: Record<string, string[]> = {};
  for (const entry of entries) {
    const text = String(entry);
    const at = text.indexOf(':');
    if (at <= 0) continue;
    const key = text.slice(0, at).trim();
    const values = text
      .slice(at + 1)
      .split('|')
      .map((v) => v.trim())
      .filter(Boolean);
    if (key && values.length) out[key] = [...(out[key] ?? []), ...values];
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseIds(param: unknown, max = 50): string[] | undefined {
  if (param == null) return undefined;
  const ids = (Array.isArray(param) ? param : String(param).split(','))
    .map((v) => String(v).trim())
    .filter((v) => mongoose.Types.ObjectId.isValid(v));
  return ids.length ? [...new Set(ids)].slice(0, max) : undefined;
}

/** A built-in key or anything shaped like a collection slug (resolved in buildScopeConditions). */
export const parseCollection = (param: unknown): Collection | undefined =>
  typeof param === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(param) ? param : undefined;

/**
 * `$match` conditions for a catalog scope. `notFound` is set when the category slug is unknown.
 * `rank` is the best-seller order for the best-sellers collection.
 */
export async function buildScopeConditions(
  scope: CatalogScope
): Promise<{ conditions: Record<string, unknown>[]; notFound?: boolean; rank?: Types.ObjectId[] }> {
  const conditions: Record<string, unknown>[] = [];
  let rank: Types.ObjectId[] | undefined;

  if (scope.category) {
    const ids = await categoryIdsForSlug(scope.category);
    if (!ids) return { conditions, notFound: true };
    conditions.push({ category: { $in: ids } });
  }

  if (scope.ids?.length) {
    conditions.push({ _id: { $in: scope.ids.map((id) => new mongoose.Types.ObjectId(id)) } });
  }

  // Add-ons (gift boxes, wrapping) are sold alongside other products, so plain browsing
  // (Shop All, collections, rails) leaves them out. Their own category, a search or an id list
  // still returns them. Stores without an add-on category are unaffected.
  if (!scope.category && !scope.ids?.length && !scope.query?.trim()) {
    const addOnCategories = await Category.find({ isAddOnCategory: true }).select('_id').lean();
    if (addOnCategories.length) conditions.push({ category: { $nin: addOnCategories.map((c) => c._id) } });
  }

  if (scope.specs) {
    for (const [key, values] of Object.entries(scope.specs)) {
      conditions.push({ specifications: { $elemMatch: { key, value: { $in: values } } } });
    }
  }

  if (scope.collection === 'best-sellers') {
    rank = await getBestSellerIds();
    conditions.push({ _id: { $in: rank } });
  } else if (scope.collection === 'new-arrivals' || scope.collection === 'latest-drops') {
    const { newArrivalDays } = await getCatalogSettings();
    conditions.push({ createdAt: { $gte: newArrivalCutoff(newArrivalDays) } });
  } else if (scope.collection === 'back-in-stock') {
    const days = backInStockDays();
    if (!days) return { conditions, notFound: true };
    conditions.push({ restockedAt: { $gte: backInStockCutoff(days) }, stock: { $gt: 0 } });
  } else if (scope.collection) {
    const custom = await collectionConditions(scope.collection);
    if (!custom) return { conditions, notFound: true };
    conditions.push(...custom.conditions);
    rank = custom.rank;
  }

  return { conditions, rank };
}

/** Sort stages that order documents by their position in `rank` (unranked last, newest first). */
export function rankSortStages(rank: Types.ObjectId[]): PipelineStage[] {
  return [
    {
      $addFields: {
        _rank: {
          $let: {
            vars: { i: { $indexOfArray: [rank, '$_id'] } },
            in: { $cond: [{ $eq: ['$$i', -1] }, Number.MAX_SAFE_INTEGER, '$$i'] },
          },
        },
      },
    },
    { $sort: { _rank: 1, createdAt: -1 } },
    { $project: { _rank: 0 } },
  ];
}

export type Badges = { isNew: boolean; isBestSeller: boolean; isBackInStock: boolean; isLowStock: boolean };

type BadgeFields = { _id?: unknown; createdAt?: unknown; stock?: unknown; lowStockThreshold?: unknown; restockedAt?: unknown };

/**
 * Adds `badges` to each product: new, best seller, back in stock (restocked within
 * BACK_IN_STOCK_DAYS) and low stock (in stock, at or under its low-stock threshold).
 */
export async function withBadges<T extends BadgeFields>(
  products: T[]
): Promise<Array<T & { badges: Badges }>> {
  if (!products.length) return [];
  const [best, { newArrivalDays }] = await Promise.all([getBestSellerIds(), getCatalogSettings()]);
  const bestSet = new Set(best.map(String));
  const cutoff = newArrivalCutoff(newArrivalDays).getTime();
  const restockDays = backInStockDays();
  const restockCutoff = restockDays ? backInStockCutoff(restockDays).getTime() : null;
  return products.map((p) => {
    const stock = Number(p.stock ?? 0);
    const threshold = Number(p.lowStockThreshold ?? 0);
    return {
      ...p,
      badges: {
        isNew: !!p.createdAt && new Date(p.createdAt as string | Date).getTime() >= cutoff,
        isBestSeller: bestSet.has(String(p._id)),
        isBackInStock: restockCutoff !== null && stock > 0 && !!p.restockedAt && new Date(p.restockedAt as string | Date).getTime() >= restockCutoff,
        isLowStock: stock > 0 && threshold > 0 && stock <= threshold,
      },
    };
  });
}

/** Forget cached settings and best sellers (after a settings change, and in tests). */
export function resetCatalogCaches(): void {
  settingsCache = null;
  bestSellerCache = null;
}
