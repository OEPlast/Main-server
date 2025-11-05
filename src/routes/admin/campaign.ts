import express from 'express';
import CampaignController from '../../controller/admin/CampaignController';
import CampaignValidator from '../../validators/admin/CampaignValidator';
import { authenticateUser, isAdmin, requirePermission } from '../../middleware/auth';

const router = express.Router();

// All campaign routes require authentication and admin privileges
router.use(authenticateUser, isAdmin);

// Campaign CRUD operations
router.post(
  '/create',
  requirePermission('campaigns', 'create'),
  CampaignValidator.createCampaignValidator,
  CampaignController.createCampaign
);

router.get('/check-slug', requirePermission('campaigns', 'read'), CampaignController.checkSlug);
// Slug availability check
router.get('/list', requirePermission('campaigns', 'read'), CampaignController.getCampaignsList);
router.get('/all', requirePermission('campaigns', 'read'), CampaignController.getAllCampaigns);
router.get(
  '/:campaignId',
  requirePermission('campaigns', 'read'),
  CampaignValidator.campaignIdValidator,
  CampaignController.getCampaignById
);
router.put(
  '/:campaignId',
  requirePermission('campaigns', 'update'),
  CampaignValidator.updateCampaignValidator,
  CampaignController.updateCampaign
);
router.delete(
  '/:campaignId',
  requirePermission('campaigns', 'delete'),
  CampaignValidator.campaignIdValidator,
  CampaignController.deleteCampaign
);

// Campaign status management
router.patch(
  '/:campaignId/status',
  requirePermission('campaigns', 'update'),
  CampaignValidator.toggleStatusValidator,
  CampaignController.toggleCampaignStatus
);


export default router;
