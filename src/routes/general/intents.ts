import { Router } from 'express';
import IntentController from '../../controller/IntentController';

const router = Router();

/**
 * @route  GET /intents
 * @desc   All active intent shops (full config) — storefront page rendering
 * @access Public
 */
router.get('/', IntentController.getActiveIntents);

/**
 * @route  GET /intents/slugs
 * @desc   Active intent slugs + updatedAt — storefront sitemap / static params
 * @access Public
 */
router.get('/slugs', IntentController.getActiveIntentSlugs);

/**
 * @route  GET /intents/:slug
 * @desc   A single active intent shop
 * @access Public
 */
router.get('/:slug', IntentController.getIntentBySlug);

export default router;
