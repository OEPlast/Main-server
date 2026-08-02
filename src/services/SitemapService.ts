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
    const categories = await Category.aggregate([
      {
        $match: {},
      },
      {
        $project: {
          _id: 0,
          slug: 1,
          updatedAt: 1,
          image: 1,
        },
      },
      {
        $sort: { updatedAt: -1 },
      },
    ]);

    return categories;
  }
}

export default new SitemapService();
