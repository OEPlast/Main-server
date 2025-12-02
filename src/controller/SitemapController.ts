import { Request, Response } from 'express';
import SitemapService from '../services/SitemapService';

/**
 * SitemapController
 * Handles sitemap-related requests
 */
class SitemapController {
  /**
   * @route GET /sitemap/products
   * @desc Get all product slugs for sitemap
   * @access Public
   */
  async getProductSlugs(req: Request, res: Response) {
    try {
      const products = await SitemapService.getProductSlugs();

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      console.error('Error fetching product slugs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product slugs',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * @route GET /sitemap/categories
   * @desc Get all category slugs for sitemap
   * @access Public
   */
  async getCategorySlugs(req: Request, res: Response) {
    try {
      const categories = await SitemapService.getCategorySlugs();

      res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      console.error('Error fetching category slugs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch category slugs',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default new SitemapController();
