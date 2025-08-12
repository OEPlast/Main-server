import express from 'express';
import CampaignController from '../../controller/admin/CampaignController';
import CampaignValidator from '../../validators/admin/CampaignValidator';
import { isAuthenticated, isAdmin, requirePermission } from '../../middleware/auth';

const router = express.Router();

// All campaign routes require authentication and admin privileges
router.use(isAuthenticated, isAdmin);

// Campaign CRUD operations
router.post(
  '/',
  requirePermission('campaigns', 'create'),
  CampaignValidator.createCampaignValidator,
  CampaignController.createCampaign
);
router.get('/', requirePermission('campaigns', 'read'), CampaignController.getAllCampaigns);
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

// Campaign product management
router.post(
  '/:campaignId/products',
  requirePermission('campaigns', 'update'),
  CampaignValidator.addProductValidator,
  CampaignController.addProductToCampaign
);
router.delete(
  '/:campaignId/products/:productId',
  requirePermission('campaigns', 'update'),
  CampaignValidator.removeProductValidator,
  CampaignController.removeProductFromCampaign
);

export default router;
