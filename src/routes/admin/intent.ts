import express from 'express';
import IntentController from '../../controller/admin/IntentController';
import IntentValidator from '../../validators/admin/IntentValidator';
import { authenticateUser, isAdmin, requirePermission } from '../../middleware/auth';

const router = express.Router();

// All intent routes require authentication and admin privileges.
router.use(authenticateUser, isAdmin);

/**
 * @route POST /admin/intents/create
 * @desc  Create an intent shop (programmatic SEO landing page)
 */
router.post(
  '/create',
  requirePermission('intents', 'create'),
  IntentValidator.createIntentValidator,
  IntentController.createIntent
);

/**
 * @route GET /admin/intents/check-slug?slug=&excludeId=
 * @desc  Slug availability check for the create/edit form
 */
router.get('/check-slug', requirePermission('intents', 'read'), IntentController.checkSlug);

/**
 * @route GET /admin/intents/all?status=
 * @desc  List intents for the admin table
 */
router.get('/all', requirePermission('intents', 'read'), IntentController.getAllIntents);

/**
 * @route GET /admin/intents/:intentId
 */
router.get(
  '/:intentId',
  requirePermission('intents', 'read'),
  IntentValidator.intentIdValidator,
  IntentController.getIntentById
);

/**
 * @route PUT /admin/intents/:intentId
 */
router.put(
  '/:intentId',
  requirePermission('intents', 'update'),
  IntentValidator.updateIntentValidator,
  IntentController.updateIntent
);

/**
 * @route DELETE /admin/intents/:intentId
 */
router.delete(
  '/:intentId',
  requirePermission('intents', 'delete'),
  IntentValidator.intentIdValidator,
  IntentController.deleteIntent
);

/**
 * @route PATCH /admin/intents/:intentId/status
 * @desc  Publish / unpublish an intent (active|inactive|draft)
 */
router.patch(
  '/:intentId/status',
  requirePermission('intents', 'update'),
  IntentValidator.toggleStatusValidator,
  IntentController.toggleIntentStatus
);

export default router;
