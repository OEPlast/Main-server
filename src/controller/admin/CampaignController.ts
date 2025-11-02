import { Request, Response } from 'express';
import CampaignService from '../../services/admin/CampaignService';

const createCampaign = async (req: Request, res: Response) => {
  try {
    const campaignData = req.body;
    const result = await CampaignService.createCampaign(campaignData);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in createCampaign:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllCampaigns = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const result = await CampaignService.getAllCampaigns(status as string);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getAllCampaigns:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getCampaignById = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await CampaignService.getCampaignById(campaignId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getCampaignById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateCampaign = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const updates = req.body;
    const result = await CampaignService.updateCampaign(campaignId, updates);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in updateCampaign:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await CampaignService.deleteCampaign(campaignId);
    return res.status(result.code).json({ message: result.message });
  } catch (error) {
    console.error('Error in deleteCampaign:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const toggleCampaignStatus = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { status } = req.body;
    const result = await CampaignService.toggleCampaignStatus(campaignId, status);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in toggleCampaignStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const addProductToCampaign = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { productId } = req.body as { productId: string };
    const result = await CampaignService.addProductToCampaign(campaignId, productId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in addProductToCampaign:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const removeProductFromCampaign = async (req: Request, res: Response) => {
  try {
    const { campaignId, productId } = req.params;
    const result = await CampaignService.removeProductFromCampaign(campaignId, productId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in removeProductFromCampaign:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getCampaignsList = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const result = await CampaignService.getCampaignsList(status as string);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getCampaignsList:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const checkSlug = async (req: Request, res: Response) => {
  try {
    const { slug, excludeId } = req.query as { slug?: string; excludeId?: string };
    if (!slug) return res.status(400).json({ message: 'slug is required', data: null, code: 400 });
    const result = await CampaignService.checkSlugAvailability(slug, excludeId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in checkSlug:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export default {
  checkSlug,
  createCampaign,
  getAllCampaigns,
  getCampaignsList,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  toggleCampaignStatus,
  addProductToCampaign,
  removeProductFromCampaign,
};
