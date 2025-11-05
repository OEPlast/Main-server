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
    const result = await UserCampaignService.getActiveCampaignById({
      campaignId,
    });
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getActiveCampaignById:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getActiveCampaignBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params as { slug: string };
    const result = await UserCampaignService.getActiveCampaignBySlug({
      slug,
    });
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getActiveCampaignBySlug:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get filters for campaign products
 * Returns aggregated filter data (price range, attributes, specs, tags, pack sizes)
 */
const getCampaignFilters = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params as { slug: string };
    const result = await UserCampaignService.getCampaignFilters(slug);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getCampaignFilters:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export default { getAllActiveCampaigns, getActiveCampaignById, getActiveCampaignBySlug, getCampaignFilters };
