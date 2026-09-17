import Product from '../models/Product';
import Category from '../models/Category';

/**
 * SitemapService
 * Handles sitemap data generation using MongoDB aggregation pipelines
 */
class SitemapService {
  /**
   * Get all active product slugs with update timestamps + cover image
   * (cover image powers the storefront's image sitemap → Google Images traffic).
   * Uses aggregation pipeline to avoid loading full documents.
   */
  async getProductSlugs() {
    const products = await Product.aggregate([
      {
        $match: {
          status: 'active',
        },
      },
      {
        $project: {
          _id: 0,
          slug: 1,
          updatedAt: 1,
          // Prefer the flagged cover image, else the first image.
          coverImage: {
            $let: {
              vars: {
                cover: {
                  $first: {
                    $filter: {
                      input: { $ifNull: ['$description_images', []] },
                      as: 'img',
                      cond: { $eq: ['$$img.cover_image', true] },
                    },
                  },
                },
              },
              in: {
                $ifNull: [
                  '$$cover.url',
                  { $first: { $ifNull: ['$description_images.url', []] } },
                ],
              },
            },
          },
        },
      },
      {
        $sort: { updatedAt: -1 },
      },
    ]);

    return products;
  }

  /**
   * Get all category slugs with update timestamps + image.
   * Uses aggregation pipeline to avoid loading full documents.
   */
  async getCategorySlugs() {
    // Only categories a shopper would find products in. An empty category page renders "No products
    // found" — submitting it to search engines produced exactly that snippet in Google. A category
    // counts as non-empty when it, or a direct subcategory, has an active product: that is how
    // productService.getByCategorySlug decides what the page shows.
    const [categoryIdsWithProducts, categories] = await Promise.all([
      Product.distinct('category', { status: 'active' }),
      Category.find({}).select('slug updatedAt image parent').sort({ updatedAt: -1 }).lean(),
    ]);

    const nonEmpty = new Set(categoryIdsWithProducts.map((id) => String(id)));
    for (const category of categories) {
      if (!nonEmpty.has(String(category._id))) continue;
      for (const parentId of (category.parent as unknown[] | undefined) ?? []) nonEmpty.add(String(parentId));
    }

    return categories
      .filter((category) => nonEmpty.has(String(category._id)))
      .map(({ slug, updatedAt, image }) => ({ slug, updatedAt, image }));
  }
}

export default new SitemapService();
