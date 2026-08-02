import { Request, Response } from 'express';
import FeedService from '../services/FeedService';

/**
 * FeedController
 * Serves the Google Merchant Center product feed.
 */
class FeedController {
  /**
   * @route GET /feed/google.xml
   * @desc  Google Merchant Center product feed (RSS 2.0 + g: namespace)
   * @access Public
   */
  async getGoogleProductFeed(req: Request, res: Response) {
    try {
      const xml = await FeedService.generateProductFeed();
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      // Cache at the edge/CDN for an hour; Merchant Center refetches periodically.
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.status(200).send(xml);
    } catch (error) {
      console.error('Error generating product feed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate product feed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default new FeedController();
