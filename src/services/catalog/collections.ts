import mongoose, { Types } from 'mongoose';
import Category from '@/models/Category';
import StoreCollection, { StoreCollectionType } from '@/models/StoreCollection';
import { CustomResponseType } from '@/types';
import { requestStorefrontRevalidation, StorefrontTag } from '@/services/storefront/revalidate';

/**
 * Admin-defined collections (models/StoreCollection.ts): turning one into `$match` conditions for
 * the product list, the list the category tree and menu show, and admin CRUD.
 */

const CACHE_MS = 60_000;
let cache: { at: number; list: StoreCollectionType[] } | null = null;

/** Active collections, menu order. Cached for a minute; admin writes clear it. */
export async function getActiveCollections(): Promise<StoreCollectionType[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.list;
  const list = await StoreCollection.find({ active: true }).sort({ group: 1, order: 1, title: 1 }).lean<StoreCollectionType[]>();
  cache = { at: Date.now(), list };
  return list;
}

export function resetCollectionCache(): void {
  cache = null;
}

/** Category ids plus every category below them (categories can sit under several parents). */
async function withDescendants(ids: Types.ObjectId[]): Promise<Types.ObjectId[]> {
  const all = new Set(ids.map(String));
  let frontier = ids;
  for (let depth = 0; depth < 5 && frontier.length; depth++) {
    const children = await Category.find({ parent: { $in: frontier }, _id: { $nin: [...all].map((id) => new mongoose.Types.ObjectId(id)) } })
      .select('_id')
      .lean();
    frontier = children.map((c) => c._id as Types.ObjectId);
    frontier.forEach((id) => all.add(String(id)));
  }
  return [...all].map((id) => new mongoose.Types.ObjectId(id));
}

/**
 * `$match` conditions for an admin collection; `rank` keeps a manual collection in its picked
 * order. Null when no active collection has this slug.
 */
export async function collectionConditions(
  slug: string
): Promise<{ conditions: Record<string, unknown>[]; rank?: Types.ObjectId[] } | null> {
  const collection = (await getActiveCollections()).find((c) => c.slug === slug);
  if (!collection) return null;
  if (collection.mode === 'manual') {
    const ids = (collection.products ?? []) as Types.ObjectId[];
    return { conditions: [{ _id: { $in: ids } }], rank: ids };
  }
  const rules = collection.rules ?? {};
  const conditions: Record<string, unknown>[] = [];
  if (rules.categories?.length) conditions.push({ category: { $in: await withDescendants(rules.categories as Types.ObjectId[]) } });
  if (rules.tags?.length) conditions.push({ tags: { $in: rules.tags } });
  for (const spec of rules.specs ?? []) {
    if (spec.values?.length) conditions.push({ specifications: { $elemMatch: { key: spec.key, value: { $in: spec.values } } } });
  }
  const price: Record<string, number> = {};
  if (typeof rules.minPrice === 'number') price.$gte = rules.minPrice;
  if (typeof rules.maxPrice === 'number') price.$lte = rules.maxPrice;
  if (Object.keys(price).length) conditions.push({ price });
  // A rules collection with no rules would be every product; treat it as empty instead.
  if (!conditions.length) conditions.push({ _id: { $in: [] } });
  return { conditions };
}

// ------------------------------------------------------------------ admin

type CollectionInput = Partial<{
  slug: string;
  title: string;
  description: string;
  image: string;
  group: 'collections' | 'gifting' | 'men' | 'diamonds';
  order: number;
  showInMenu: boolean;
  active: boolean;
  mode: 'manual' | 'rules';
  products: string[];
  rules: { categories?: string[]; tags?: string[]; specs?: { key: string; values: string[] }[]; minPrice?: number | null; maxPrice?: number | null };
}>;

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

/** Built-in collection keys are taken; an admin collection can't shadow them. */
export const RESERVED_SLUGS = ['best-sellers', 'new-arrivals', 'latest-drops', 'back-in-stock'];

const changed = () => {
  resetCollectionCache();
  requestStorefrontRevalidation([StorefrontTag.CATEGORIES, StorefrontTag.PRODUCTS]);
};

const clean = (input: CollectionInput) => {
  const out: Record<string, unknown> = { ...input };
  if (input.rules) {
    const r = input.rules;
    out.rules = {
      categories: r.categories ?? [],
      tags: (r.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
      specs: (r.specs ?? []).filter((s) => s.key?.trim() && s.values?.length),
      ...(typeof r.minPrice === 'number' ? { minPrice: r.minPrice } : {}),
      ...(typeof r.maxPrice === 'number' ? { maxPrice: r.maxPrice } : {}),
    };
  }
  return out;
};

const list = async (): Promise<CustomResponseType<StoreCollectionType[]>> => {
  const data = await StoreCollection.find().sort({ group: 1, order: 1, title: 1 }).lean<StoreCollectionType[]>();
  return { message: 'Collections retrieved', data, code: 200 };
};

const get = async (id: string): Promise<CustomResponseType<StoreCollectionType>> => {
  const data = mongoose.Types.ObjectId.isValid(id) ? await StoreCollection.findById(id).lean<StoreCollectionType>() : null;
  return data ? { message: 'Collection retrieved', data, code: 200 } : { message: 'Collection not found', data: null, code: 404 };
};

const create = async (input: CollectionInput): Promise<CustomResponseType<StoreCollectionType>> => {
  const slug = toSlug(input.slug || input.title || '');
  if (!slug) return { message: 'A title is required', data: null, code: 400 };
  if (RESERVED_SLUGS.includes(slug)) return { message: `"${slug}" is a built-in collection; choose another name`, data: null, code: 400 };
  if (await StoreCollection.exists({ slug })) return { message: 'A collection with this link already exists', data: null, code: 409 };
  const doc = await StoreCollection.create({ ...clean(input), slug });
  changed();
  return { message: 'Collection created', data: doc.toObject() as StoreCollectionType, code: 201 };
};

const update = async (id: string, input: CollectionInput): Promise<CustomResponseType<StoreCollectionType>> => {
  if (!mongoose.Types.ObjectId.isValid(id)) return { message: 'Collection not found', data: null, code: 404 };
  const set = clean(input);
  if (input.slug !== undefined) {
    const slug = toSlug(input.slug);
    if (!slug) return { message: 'The link cannot be empty', data: null, code: 400 };
    if (RESERVED_SLUGS.includes(slug)) return { message: `"${slug}" is a built-in collection; choose another name`, data: null, code: 400 };
    if (await StoreCollection.exists({ slug, _id: { $ne: id } })) return { message: 'A collection with this link already exists', data: null, code: 409 };
    set.slug = slug;
  }
  const data = await StoreCollection.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean<StoreCollectionType>();
  if (!data) return { message: 'Collection not found', data: null, code: 404 };
  changed();
  return { message: 'Collection updated', data, code: 200 };
};

const remove = async (id: string): Promise<CustomResponseType<null>> => {
  if (!mongoose.Types.ObjectId.isValid(id)) return { message: 'Collection not found', data: null, code: 404 };
  const res = await StoreCollection.deleteOne({ _id: id });
  if (!res.deletedCount) return { message: 'Collection not found', data: null, code: 404 };
  changed();
  return { message: 'Collection deleted', data: null, code: 200 };
};

export const CollectionAdminService = { list, get, create, update, remove };
