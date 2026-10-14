import mongoose, { PipelineStage, Types } from 'mongoose';
import Category from '@/models/Category';
import Product from '@/models/Product';
import { escapeRegex } from '@/helpers/regex';
import { CustomResponseType } from '@/types';
import ProductService from '@/services/productService';
import SiteContent from '@/models/SiteContent';
import { getActiveCollections } from './collections';
import { backInStockCutoff, backInStockDays } from './restock';
import {
  BuiltInCollection,
  buildScopeConditions,
  builtInCollections,
  getBestSellerIds,
  getCatalogSettings,
  newArrivalCutoff,
  withBadges,
} from './catalogQuery';

const COLLECTION_LABELS: Record<BuiltInCollection, string> = {
  'best-sellers': 'Best Sellers',
  'new-arrivals': 'New Arrivals',
  'latest-drops': 'Latest Drops',
  'back-in-stock': 'Back in Stock',
};

/** A collection as the tree returns it: built-ins have group "shop"; admin ones their menu group. */
export type TreeCollection = {
  key: string;
  label: string;
  count: number;
  image?: string;
  group: 'shop' | 'collections' | 'gifting' | 'men';
  description?: string;
  showInMenu: boolean;
};

export type CategoryNode = {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  miniImage?: string;
  banner?: string;
  description?: string;
  sizeChart?: string;
  isAddOnCategory?: boolean;
  count: number;
  children: CategoryNode[];
};

const coverOf = (images?: Array<{ url?: string; cover_image?: boolean; mediaType?: string }>) =>
  images?.find((i) => i.cover_image)?.url ?? images?.find((i) => i.mediaType !== 'video')?.url ?? images?.[0]?.url;

/**
 * Every category as a tree (top level = no parent), each with the number of active products in it
 * and below it, plus the three collections with their counts and a sample image.
 */
const getCategoryTree = async (): Promise<
  CustomResponseType<{
    categories: CategoryNode[];
    collections: TreeCollection[];
  }>
> => {
  try {
    const [categories, perCategory] = await Promise.all([
      Category.find().sort({ priority: -1, name: 1 }).lean(),
      Product.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);
    const direct = new Map(perCategory.map((r) => [String(r._id), r.count]));

    const nodes = new Map<string, CategoryNode>();
    for (const c of categories) {
      nodes.set(String(c._id), {
        _id: String(c._id),
        name: c.name,
        slug: c.slug ?? '',
        image: c.image ?? undefined,
        miniImage: c.miniImage ?? undefined,
        banner: c.banner || undefined,
        description: c.description ?? undefined,
        sizeChart: (c as { sizeChart?: string }).sizeChart,
        isAddOnCategory: (c as { isAddOnCategory?: boolean }).isAddOnCategory || undefined,
        count: 0,
        children: [],
      });
    }
    const roots: CategoryNode[] = [];
    for (const c of categories) {
      const node = nodes.get(String(c._id))!;
      const parents = (c.parent ?? []).map(String).filter((id) => nodes.has(id) && id !== node._id);
      if (parents.length === 0) roots.push(node);
      for (const parentId of parents) nodes.get(parentId)!.children.push(node);
    }

    // Count = own products + every descendant's (deduplicated: a category with two parents counts once per branch).
    const total = (node: CategoryNode, seen: Set<string>): number => {
      if (seen.has(node._id)) return 0;
      seen.add(node._id);
      return (direct.get(node._id) ?? 0) + node.children.reduce((sum, child) => sum + total(child, seen), 0);
    };
    for (const node of nodes.values()) node.count = total(node, new Set());

    const { newArrivalDays } = await getCatalogSettings();
    const best = await getBestSellerIds();
    const cutoff = newArrivalCutoff(newArrivalDays);
    const sample = async (match: Record<string, unknown>) => {
      const [count, first] = await Promise.all([
        Product.countDocuments({ status: 'active', ...match }),
        Product.findOne({ status: 'active', ...match }).sort({ createdAt: -1 }).select('description_images').lean(),
      ]);
      return { count, image: coverOf(first?.description_images as never) };
    };
    const newMatch = { createdAt: { $gte: cutoff } };
    const restockDays = backInStockDays();
    const [bestStats, newStats, backStats] = await Promise.all([
      sample({ _id: { $in: best } }),
      sample(newMatch),
      restockDays ? sample({ restockedAt: { $gte: backInStockCutoff(restockDays) }, stock: { $gt: 0 } }) : Promise.resolve({ count: 0 }),
    ]);
    const stats: Record<BuiltInCollection, { count: number; image?: string }> = {
      'best-sellers': bestStats,
      'new-arrivals': newStats,
      'latest-drops': newStats,
      'back-in-stock': backStats,
    };
    const custom = await Promise.all(
      (await getActiveCollections()).map(async (c): Promise<TreeCollection> => {
        // Same scope as the product list (so add-ons are left out of the count too)
        const scope = await buildScopeConditions({ collection: c.slug });
        const s: { count: number; image?: string } = scope.notFound
          ? { count: 0 }
          : await sample(scope.conditions.length ? { $and: scope.conditions } : {});
        return {
          key: c.slug,
          label: c.title,
          count: s.count,
          image: c.image || s.image,
          group: c.group as TreeCollection['group'],
          description: c.description || undefined,
          showInMenu: c.showInMenu !== false,
        };
      })
    );

    return {
      message: 'Category tree retrieved successfully',
      data: {
        categories: roots,
        collections: [
          ...builtInCollections().map((key) => ({ key, label: COLLECTION_LABELS[key], group: 'shop' as const, showInMenu: true, ...stats[key] })),
          ...custom,
        ],
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error building category tree:', error);
    return { message: 'Failed to retrieve categories', data: null, code: 500 };
  }
};

/** Active products with their category and active sale, like the product list returns them. */
async function loadListProducts(match: Record<string, unknown>, limit: number) {
  const pipeline: PipelineStage[] = [
    { $match: { status: 'active', ...match } },
    { $limit: limit },
    { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'sales',
        let: { productId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$product', '$$productId'] }, isActive: true, deleted: false } },
          { $limit: 1 },
        ],
        as: 'sale',
      },
    },
    { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } },
  ];
  return Product.aggregate(pipeline);
}

const MAX_ADD_ONS = 5;

/**
 * Up to five products to offer next to `productId`: the ones picked on the product first, then
 * products from add-on categories (e.g. Gift Boxes).
 */
const getAddOns = async (productId: string): Promise<CustomResponseType<unknown[]>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) return { message: 'Invalid product id', data: null, code: 400 };
    const product = await Product.findById(productId).select('addOns').lean<{ addOns?: Types.ObjectId[] }>();
    if (!product) return { message: 'Product not found', data: null, code: 404 };

    const selfId = new mongoose.Types.ObjectId(productId);
    const picked = (product.addOns ?? []).filter((id) => !id.equals(selfId));
    const pickedDocs = picked.length ? await loadListProducts({ _id: { $in: picked } }, MAX_ADD_ONS) : [];
    const order = new Map(picked.map((id, i) => [String(id), i]));
    pickedDocs.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

    let results = pickedDocs;
    if (results.length < MAX_ADD_ONS) {
      const addOnCategories = await Category.find({ isAddOnCategory: true }).select('_id').lean();
      if (addOnCategories.length) {
        const exclude = [selfId, ...results.map((p) => p._id)];
        const extra = await loadListProducts(
          { category: { $in: addOnCategories.map((c) => c._id) }, _id: { $nin: exclude } },
          MAX_ADD_ONS - results.length
        );
        results = [...results, ...extra];
      }
    }
    return { message: 'Add-ons retrieved successfully', data: await withBadges(results), code: 200 };
  } catch (error) {
    console.error('Error fetching add-ons:', error);
    return { message: 'Failed to fetch add-ons', data: null, code: 500 };
  }
};

/**
 * Type-ahead suggestions: query completions (category names, tags, option values and product
 * names that contain the term), the first matching products and how many match in total.
 * An empty query returns the store's popular searches as terms.
 */
const getSuggestions = async (
  query: string,
  limit = 4
): Promise<CustomResponseType<{ terms: string[]; products: unknown[]; total: number }>> => {
  try {
    const q = query.trim();
    if (!q) {
      const content = await SiteContent.findOne().select('popularSearches').lean<{ popularSearches?: string[] }>();
      return { message: 'Popular searches', data: { terms: content?.popularSearches ?? [], products: [], total: 0 }, code: 200 };
    }
    const rx = new RegExp(escapeRegex(q), 'i');
    const lower = q.toLowerCase();

    const [categories, vocab, results] = await Promise.all([
      Category.find({ name: rx }).select('name').limit(5).lean(),
      Product.aggregate<{ tags: string[]; values: string[] }>([
        { $match: { status: 'active' } },
        {
          $project: {
            tags: { $ifNull: ['$tags', []] },
            values: {
              $reduce: {
                input: { $ifNull: ['$attributes', []] },
                initialValue: [],
                in: { $concatArrays: ['$$value', { $ifNull: ['$$this.children.name', []] }] },
              },
            },
          },
        },
        { $group: { _id: null, tags: { $addToSet: '$tags' }, values: { $addToSet: '$values' } } },
        {
          $project: {
            tags: { $reduce: { input: '$tags', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } },
            values: { $reduce: { input: '$values', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } },
          },
        },
      ]),
      ProductService.searchProductsWithFilters({ query: q, page: 1, limit: Math.max(1, Math.min(limit, 12)) }),
    ]);

    const products = (results.data ?? []) as Array<{ name: string }>;
    const words = [
      ...categories.map((c) => c.name),
      ...(vocab[0]?.tags ?? []).filter((t) => rx.test(t)),
      ...(vocab[0]?.values ?? []).filter((v) => rx.test(v)),
      ...products.map((p) => p.name),
    ];
    const seen = new Set<string>();
    const terms: string[] = [];
    for (const w of words) {
      const key = w.toLowerCase();
      if (seen.has(key) || !key.includes(lower)) continue;
      seen.add(key);
      terms.push(w);
      if (terms.length === 5) break;
    }

    return {
      message: 'Suggestions retrieved successfully',
      data: { terms, products, total: results.meta?.total ?? products.length },
      code: 200,
    };
  } catch (error) {
    console.error('Error building search suggestions:', error);
    return { message: 'Failed to fetch suggestions', data: null, code: 500 };
  }
};

const CatalogService = { getCategoryTree, getAddOns, getSuggestions };
export default CatalogService;
