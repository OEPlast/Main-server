import { Request, Response } from 'express';
import UserCampaignService from '@/services/users/CampaignService';

const getAllActiveCampaigns = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', q } = req.query as { page?: string; limit?: string; q?: string };
    const result = await UserCampaignService.getAllActiveCampaigns({
      page: Number(page),
      limit: Number(limit),
      q: q as string | undefined,
    });
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getAllActiveCampaigns:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getActiveCampaignById = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params as { campaignId: string };
    const { page = '1', limit = '20' } = req.query as { page?: string; limit?: string };
    const result = await UserCampaignService.getActiveCampaignById({
      campaignId,
      page: Number(page),
      limit: Number(limit),
    });
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getActiveCampaignById:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export default { getAllActiveCampaigns, getActiveCampaignById };
