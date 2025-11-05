import express from 'express';
import UserCampaignController from '@/controller/users/CampaignController';
import UserCampaignValidator from '@/validators/users/CampaignValidator';

const router = express.Router();

router.get('/all', UserCampaignValidator.listQueryValidator, UserCampaignController.getAllActiveCampaigns);
router.get(
  '/campaign/:campaignId',
  UserCampaignValidator.campaignIdWithProductsQueryValidator,
  UserCampaignController.getActiveCampaignById
);

router.get(
  '/slug/:slug',
  UserCampaignValidator.slugWithProductsQueryValidator,
  UserCampaignController.getActiveCampaignBySlug
);

// Get campaign filters (like category filters)
router.get('/slug/:slug/filters', UserCampaignController.getCampaignFilters);

export default router;
