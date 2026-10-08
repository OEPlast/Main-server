import { Router } from 'express';
import SitemapController from '../../controller/SitemapController';
import Article from '@/models/Article';

const router = Router();

/**
 * @route GET /sitemap/products
 * @desc Get all product slugs for sitemap generation
 * @access Public
 */
router.get('/products', SitemapController.getProductSlugs);

/**
 * @route GET /sitemap/categories
 * @desc Get all category slugs for sitemap generation
 * @access Public
 */
router.get('/categories', SitemapController.getCategorySlugs);

/**
 * @route GET /sitemap/articles
 * @desc Published journal articles (slug, updatedAt, image) for sitemap generation
 * @access Public
 */
router.get('/articles', async (_req, res) => {
  try {
    const articles = await Article.find({ status: 'published', publishedAt: { $lte: new Date() } })
      .sort({ publishedAt: -1 })
      .select('-_id slug updatedAt publishedAt image')
      .lean();
    res.status(200).json({ success: true, data: articles });
  } catch (error) {
    console.error('Error fetching article slugs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch article slugs' });
  }
});

export default router;
