import mongoose from 'mongoose';
import slugify from 'slugify';
import Article from '@/models/Article';
import FaqGroup from '@/models/FaqGroup';
import LegalDocument from '@/models/LegalDocument';
import SizeChart from '@/models/SizeChart';
import SiteContent from '@/models/SiteContent';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import { duplicateMessage, isDuplicateKeyError } from '@/middleware/mongodb';
import { articleTag, requestStorefrontRevalidation, StorefrontTag } from '@/services/storefront/revalidate';

/**
 * Storefront content: journal articles, home content, FAQs, legal pages and size charts.
 * Public reads only ever return published articles; every admin write purges the storefront cache.
 */

type Res<T> = Promise<CustomResponseType<T>>;
const ok = <T>(message: string, data: T, code = 200) => ({ message, data, code });
const fail = (message: string, code: number) => ({ message, data: null, code });

async function guard<T>(label: string, fn: () => Res<T>): Res<T> {
  try {
    return await fn();
  } catch (error) {
    if (isDuplicateKeyError(error)) return fail(duplicateMessage(error, label), 400);
    if (error instanceof mongoose.Error.ValidationError) return fail(error.message, 400);
    console.error(`[content] ${label} failed:`, error);
    return fail('Something went wrong', 500);
  }
}

const toSlug = (value: string) => slugify(value, { lower: true, strict: true });
const purgeContent = () => requestStorefrontRevalidation([StorefrontTag.CONTENT]);

// ---------------------------------------------------------------- articles --

export type ArticleInput = {
  title?: string;
  slug?: string;
  excerpt?: string;
  category?: string;
  image?: string;
  status?: 'draft' | 'published';
  publishedAt?: string | Date;
  body?: Array<{ type: string; text?: string; src?: string; alt?: string }>;
  seo?: { title?: string; description?: string };
};

const publicArticleFilter = () => ({ status: 'published', publishedAt: { $lte: new Date() } });

/** Published articles, newest first. Page 1 of the unfiltered list also returns the newest as `featured`. */
const listPublishedArticles = async (opts: {
  page?: number;
  limit?: number;
  category?: string;
}): CustomResponseTypeWithMeta<{
  items: unknown[];
  page: number;
  totalPages: number;
  total: number;
  featured: unknown | null;
}> =>
  guard('Article', async () => {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 9));
    const base = publicArticleFilter();
    let featured: unknown | null = null;
    const filter: Record<string, unknown> = { ...base };
    if (opts.category) {
      filter.category = opts.category;
    } else {
      featured = await Article.findOne(base).sort({ publishedAt: -1 }).select('-body').lean();
      if (featured) filter._id = { $ne: (featured as { _id: unknown })._id };
    }
    const [items, total] = await Promise.all([
      Article.find(filter)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-body')
        .lean(),
      Article.countDocuments(filter),
    ]);
    return ok('Articles retrieved successfully', {
      items,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      total,
      featured,
    });
  });

/** A published article plus the next two to read (older ones first, wrapping to the newest). */
const getPublishedArticle = async (slug: string): Res<{ article: unknown; upNext: unknown[] }> =>
  guard('Article', async () => {
    const article = await Article.findOne({ ...publicArticleFilter(), slug: slug.toLowerCase() }).lean();
    if (!article) return fail('Article not found', 404);
    const older = await Article.find({ ...publicArticleFilter(), publishedAt: { $lt: article.publishedAt } })
      .sort({ publishedAt: -1 })
      .limit(2)
      .select('-body')
      .lean();
    let upNext = older;
    if (upNext.length < 2) {
      const newest = await Article.find({
        ...publicArticleFilter(),
        _id: { $nin: [article._id, ...older.map((a) => a._id)] },
      })
        .sort({ publishedAt: -1 })
        .limit(2 - upNext.length)
        .select('-body')
        .lean();
      upNext = [...upNext, ...newest];
    }
    return ok('Article retrieved successfully', { article, upNext });
  });

const listAllArticles = async (opts: { page?: number; limit?: number; status?: string; search?: string }) =>
  guard('Article', async () => {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const filter: Record<string, unknown> = {};
    if (opts.status) filter.status = opts.status;
    if (opts.search) filter.title = { $regex: opts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const [items, total] = await Promise.all([
      Article.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).select('-body').lean(),
      Article.countDocuments(filter),
    ]);
    return { ...ok('Articles retrieved successfully', items), meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  });

const getArticleById = async (id: string) =>
  guard('Article', async () => {
    const article = await Article.findById(id).lean();
    return article ? ok('Article retrieved successfully', article) : fail('Article not found', 404);
  });

const normaliseArticle = (input: ArticleInput, existing?: { publishedAt?: Date | null; status?: string }) => {
  const data: Record<string, unknown> = { ...input };
  if (input.slug !== undefined) data.slug = toSlug(input.slug);
  if (input.publishedAt) data.publishedAt = new Date(input.publishedAt);
  // Publishing without a date publishes now.
  const status = input.status ?? existing?.status;
  if (status === 'published' && !data.publishedAt && !existing?.publishedAt) data.publishedAt = new Date();
  return data;
};

const createArticle = async (input: ArticleInput) =>
  guard('Article', async () => {
    const data = normaliseArticle({ ...input, slug: input.slug || input.title || '' });
    const article = await Article.create(data);
    requestStorefrontRevalidation([StorefrontTag.ARTICLES, articleTag(article.slug)]);
    return ok('Article created successfully', article, 201);
  });

const updateArticle = async (id: string, input: ArticleInput) =>
  guard('Article', async () => {
    const existing = await Article.findById(id);
    if (!existing) return fail('Article not found', 404);
    const oldSlug = existing.slug;
    existing.set(normaliseArticle(input, existing));
    await existing.save();
    requestStorefrontRevalidation([StorefrontTag.ARTICLES, articleTag(oldSlug), articleTag(existing.slug)]);
    return ok('Article updated successfully', existing);
  });

const deleteArticle = async (id: string) =>
  guard('Article', async () => {
    const article = await Article.findByIdAndDelete(id);
    if (!article) return fail('Article not found', 404);
    requestStorefrontRevalidation([StorefrontTag.ARTICLES, articleTag(article.slug)]);
    return ok('Article deleted successfully', null);
  });

// ------------------------------------------------------------ site content --

const getOrCreateSiteContent = async () => (await SiteContent.findOne()) ?? (await SiteContent.create({}));

/** Feature blocks with their products' names and pictures, for the admin form. */
const FEATURE_PRODUCT_FIELDS = 'name slug status description_images images';

const getHomeContent = async () =>
  guard('Site content', async () => {
    const c = await getOrCreateSiteContent();
    return ok('Home content retrieved successfully', {
      home: {
        hero: { image: c.home?.hero?.image ?? '', title: c.home?.hero?.title ?? '', ctaLabel: c.home?.hero?.ctaLabel ?? '', ctaHref: c.home?.hero?.ctaHref ?? '' },
        tiles: c.home?.tiles ?? [],
        feature: {
          image: c.home?.feature?.image ?? '',
          title: c.home?.feature?.title ?? '',
          text: c.home?.feature?.text ?? '',
          ctaLabel: c.home?.feature?.ctaLabel ?? '',
          ctaHref: c.home?.feature?.ctaHref ?? '',
        },
        // Product ids only: the storefront reads the products themselves (live prices and stock).
        features: (c.home?.features ?? []).map((f) => ({
          image: f.image,
          title: f.title ?? '',
          text: f.text ?? '',
          ctaLabel: f.ctaLabel ?? '',
          ctaHref: f.ctaHref ?? '',
          products: (f.products ?? []).map(String),
        })),
      },
      about: {
        hero: { image: c.about?.hero?.image ?? '', title: c.about?.hero?.title ?? '', text: c.about?.hero?.text ?? '' },
        quote: { text: c.about?.quote?.text ?? '', author: c.about?.quote?.author ?? '' },
        mission: { image: c.about?.mission?.image ?? '', title: c.about?.mission?.title ?? '', text: c.about?.mission?.text ?? '' },
        milestones: c.about?.milestones ?? [],
      },
      listingTiles: c.listingTiles ?? [],
      productInfo: { warranty: c.productInfo?.warranty ?? '', deliveryReturns: c.productInfo?.deliveryReturns ?? '' },
      testimonials: c.testimonials,
      instagram: c.instagram,
      popularSearches: c.popularSearches,
      articleCategories: c.articleCategories,
      newsletterPopup: {
        enabled: c.newsletterPopup?.enabled ?? false,
        headline: c.newsletterPopup?.headline ?? '',
        body: c.newsletterPopup?.body ?? '',
      },
    });
  });

const getSiteContent = async () =>
  guard('Site content', async () => {
    const c = await getOrCreateSiteContent();
    await c.populate({ path: 'home.features.products', select: FEATURE_PRODUCT_FIELDS });
    return ok('Site content retrieved', c);
  });

const updateSiteContent = async (input: Record<string, unknown>) =>
  guard('Site content', async () => {
    const c = await getOrCreateSiteContent();
    const fields = ['home', 'about', 'productInfo', 'listingTiles', 'testimonials', 'instagram', 'popularSearches', 'articleCategories', 'newsletterPopup'] as const;
    for (const f of fields) if (input[f] !== undefined) c.set(f, input[f]);
    await c.save();
    requestStorefrontRevalidation([StorefrontTag.CONTENT, StorefrontTag.ARTICLES]);
    await c.populate({ path: 'home.features.products', select: FEATURE_PRODUCT_FIELDS });
    return ok('Site content updated successfully', c);
  });

// -------------------------------------------------------------------- FAQs --

const listFaqGroups = async () =>
  guard('FAQ', async () => ok('FAQs retrieved successfully', await FaqGroup.find().sort({ order: 1, label: 1 }).lean()));

const createFaqGroup = async (input: { key?: string; label: string; order?: number; items?: unknown[] }) =>
  guard('FAQ group', async () => {
    const group = await FaqGroup.create({ ...input, key: toSlug(input.key || input.label) });
    purgeContent();
    return ok('FAQ group created successfully', group, 201);
  });

const updateFaqGroup = async (id: string, input: { key?: string; label?: string; order?: number; items?: unknown[] }) =>
  guard('FAQ group', async () => {
    const data = { ...input, ...(input.key ? { key: toSlug(input.key) } : {}) };
    const group = await FaqGroup.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!group) return fail('FAQ group not found', 404);
    purgeContent();
    return ok('FAQ group updated successfully', group);
  });

const deleteFaqGroup = async (id: string) =>
  guard('FAQ group', async () => {
    const group = await FaqGroup.findByIdAndDelete(id);
    if (!group) return fail('FAQ group not found', 404);
    purgeContent();
    return ok('FAQ group deleted successfully', null);
  });

// ------------------------------------------------------------ legal pages --

const getLegalDocument = async (slug: string) =>
  guard('Legal document', async () => {
    const doc = await LegalDocument.findOne({ slug: slug.toLowerCase() }).lean();
    return doc ? ok('Document retrieved successfully', doc) : fail('Document not found', 404);
  });

const listLegalDocuments = async () =>
  guard('Legal document', async () =>
    ok('Documents retrieved successfully', await LegalDocument.find().select('-sections').sort({ title: 1 }).lean())
  );

const getLegalDocumentById = async (id: string) =>
  guard('Legal document', async () => {
    const doc = await LegalDocument.findById(id).lean();
    return doc ? ok('Document retrieved successfully', doc) : fail('Document not found', 404);
  });

const createLegalDocument = async (input: Record<string, unknown>) =>
  guard('Legal document', async () => {
    const doc = await LegalDocument.create({ ...input, slug: toSlug(String(input.slug || input.title || '')) });
    purgeContent();
    return ok('Document created successfully', doc, 201);
  });

const updateLegalDocument = async (id: string, input: Record<string, unknown>) =>
  guard('Legal document', async () => {
    const data = { ...input, ...(input.slug ? { slug: toSlug(String(input.slug)) } : {}) };
    const doc = await LegalDocument.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!doc) return fail('Document not found', 404);
    purgeContent();
    return ok('Document updated successfully', doc);
  });

const deleteLegalDocument = async (id: string) =>
  guard('Legal document', async () => {
    const doc = await LegalDocument.findByIdAndDelete(id);
    if (!doc) return fail('Document not found', 404);
    purgeContent();
    return ok('Document deleted successfully', null);
  });

// ------------------------------------------------------------ size charts --

const getSizeChart = async (slug: string) =>
  guard('Size chart', async () => {
    const chart = await SizeChart.findOne({ slug: slug.toLowerCase() }).lean();
    return chart ? ok('Size chart retrieved successfully', chart) : fail('Size chart not found', 404);
  });

const listSizeCharts = async () =>
  guard('Size chart', async () => ok('Size charts retrieved successfully', await SizeChart.find().sort({ title: 1 }).lean()));

const getSizeChartById = async (id: string) =>
  guard('Size chart', async () => {
    const chart = await SizeChart.findById(id).lean();
    return chart ? ok('Size chart retrieved successfully', chart) : fail('Size chart not found', 404);
  });

const validateChartShape = (input: Record<string, unknown>) => {
  const columns = input.columns as string[] | undefined;
  const rows = input.rows as string[][] | undefined;
  if (columns && rows && rows.some((r) => r.length !== columns.length)) {
    return 'Every row needs one value per column';
  }
  return null;
};

const createSizeChart = async (input: Record<string, unknown>) =>
  guard('Size chart', async () => {
    const shapeError = validateChartShape(input);
    if (shapeError) return fail(shapeError, 400);
    const chart = await SizeChart.create({ ...input, slug: toSlug(String(input.slug || input.title || '')) });
    purgeContent();
    return ok('Size chart created successfully', chart, 201);
  });

const updateSizeChart = async (id: string, input: Record<string, unknown>) =>
  guard('Size chart', async () => {
    const existing = await SizeChart.findById(id);
    if (!existing) return fail('Size chart not found', 404);
    const shapeError = validateChartShape({
      columns: input.columns ?? existing.columns,
      rows: input.rows ?? existing.rows,
    });
    if (shapeError) return fail(shapeError, 400);
    existing.set({ ...input, ...(input.slug ? { slug: toSlug(String(input.slug)) } : {}) });
    await existing.save();
    purgeContent();
    requestStorefrontRevalidation([StorefrontTag.PRODUCTS]);
    return ok('Size chart updated successfully', existing);
  });

const deleteSizeChart = async (id: string) =>
  guard('Size chart', async () => {
    const chart = await SizeChart.findByIdAndDelete(id);
    if (!chart) return fail('Size chart not found', 404);
    purgeContent();
    return ok('Size chart deleted successfully', null);
  });

const ContentService = {
  listPublishedArticles,
  getPublishedArticle,
  listAllArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  getHomeContent,
  getSiteContent,
  updateSiteContent,
  listFaqGroups,
  createFaqGroup,
  updateFaqGroup,
  deleteFaqGroup,
  getLegalDocument,
  listLegalDocuments,
  getLegalDocumentById,
  createLegalDocument,
  updateLegalDocument,
  deleteLegalDocument,
  getSizeChart,
  listSizeCharts,
  getSizeChartById,
  createSizeChart,
  updateSizeChart,
  deleteSizeChart,
};
export default ContentService;
