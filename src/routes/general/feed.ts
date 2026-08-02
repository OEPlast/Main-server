import { Router } from 'express';
import FeedController from '../../controller/FeedController';

const router = Router();

/**
 * @route GET /feed/google.xml
 * @desc Google Merchant Center product feed
 * @access Public
 */
router.get('/google.xml', FeedController.getGoogleProductFeed);

export default router;
