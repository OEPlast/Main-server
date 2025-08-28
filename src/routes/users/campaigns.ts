import express from 'express';
import UserCampaignController from '@/controller/users/CampaignController';
import UserCampaignValidator from '@/validators/users/CampaignValidator';

const router = express.Router();

router.get('/all', UserCampaignValidator.listQueryValidator, UserCampaignController.getAllActiveCampaigns);
router.get(
  '/one/:campaignId',
  UserCampaignValidator.campaignIdWithProductsQueryValidator,
  UserCampaignController.getActiveCampaignById
);

export default router;
