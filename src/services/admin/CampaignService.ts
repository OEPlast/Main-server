import Campaign, { ICampaign } from '../../models/Campaign';
import { Types } from 'mongoose';
import { CustomResponseType } from '@/types';

const createCampaign = async (campaignData: {
  title: string;
  description?: string;
  image: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'inactive' | 'draft';
  products?: string[];
  sales?: string[];
}): Promise<CustomResponseType<ICampaign>> => {
  try {
    const campaign = new Campaign({
      ...campaignData,
    });

    await campaign.save();
    await campaign.populate([
      { path: 'products', select: 'name price description slug status' },
      { path: 'sales', select: 'title type startDate endDate isActive' },
    ]);

    return {
      message: 'Campaign created successfully',
      data: campaign,
      code: 201,
    };
  } catch (error) {
    console.error('Error creating campaign:', error);
    return {
      message: 'Failed to create campaign',
      data: null,
      code: 500,
    };
  }
};

const getAllCampaigns = async (
  status?: string
): Promise<CustomResponseType<{ campaigns: ICampaign[]; total: number; page: number; limit: number }>> => {
  try {
    const filter = status ? { status } : {};

    // Admin listing: no pagination, populate both products and sales
    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate({ path: 'products', select: 'name price description slug status' })
        .populate({ path: 'sales', select: 'title type startDate endDate isActive' })
        .sort({ createdAt: -1 }),
      Campaign.countDocuments(filter),
    ]);

    return {
      message: 'Campaigns retrieved successfully',
      data: { campaigns, total, page: 1, limit: campaigns.length },
      code: 200,
    };
  } catch (error) {
    console.error('Error getting campaigns:', error);
    return {
      message: 'Failed to retrieve campaigns',
      data: null,
      code: 500,
    };
  }
};

const getCampaignById = async (campaignId: string): Promise<CustomResponseType<ICampaign>> => {
  try {
    const campaign = await Campaign.findById(campaignId)
      .populate({ path: 'products', select: 'name price description slug status' })
      .populate({ path: 'sales', select: 'title type startDate endDate isActive' });

    if (!campaign) {
      return {
        message: 'Campaign not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Campaign retrieved successfully',
      data: campaign,
      code: 200,
    };
  } catch (error) {
    console.error('Error getting campaign:', error);
    return {
      message: 'Failed to retrieve campaign',
      data: null,
      code: 500,
    };
  }
};

const updateCampaign = async (
  campaignId: string,
  updates: Partial<ICampaign>
): Promise<CustomResponseType<ICampaign>> => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(campaignId, updates, { new: true })
      .populate({ path: 'products', select: 'name price description slug status' })
      .populate({ path: 'sales', select: 'title type startDate endDate isActive' });

    if (!campaign) {
      return {
        message: 'Campaign not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Campaign updated successfully',
      data: campaign,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating campaign:', error);
    return {
      message: 'Failed to update campaign',
      data: null,
      code: 500,
    };
  }
};

const deleteCampaign = async (campaignId: string): Promise<CustomResponseType> => {
  try {
    const campaign = await Campaign.findByIdAndDelete(campaignId);

    if (!campaign) {
      return {
        message: 'Campaign not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Campaign deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return {
      message: 'Failed to delete campaign',
      data: null,
      code: 500,
    };
  }
};

const toggleCampaignStatus = async (
  campaignId: string,
  status: 'active' | 'inactive'
): Promise<CustomResponseType<ICampaign>> => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(campaignId, { status }, { new: true })
      .populate({ path: 'products', select: 'name price description slug status' })
      .populate({ path: 'sales', select: 'title type startDate endDate isActive' });

    if (!campaign) {
      return {
        message: 'Campaign not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: `Campaign ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: campaign,
      code: 200,
    };
  } catch (error) {
    console.error('Error toggling campaign status:', error);
    return {
      message: 'Failed to update campaign status',
      data: null,
      code: 500,
    };
  }
};

const addProductToCampaign = async (campaignId: string, productId: string): Promise<CustomResponseType<ICampaign>> => {
  try {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return {
        message: 'Campaign not found',
        data: null,
        code: 404,
      };
    }

    // Check if product already exists in campaign
    const existingProduct = (campaign.products as unknown[]).some((p) => p?.toString() === productId);

    if (existingProduct) {
      return {
        message: 'Product already exists in campaign',
        data: null,
        code: 400,
      };
    }

    // Push product id (Mongoose will cast string to ObjectId)
    (campaign.products as unknown[]).push(productId);

    await campaign.save();
    await campaign.populate([
      { path: 'products', select: 'name price description slug status' },
      { path: 'sales', select: 'title type startDate endDate isActive' },
    ]);

    return {
      message: 'Product added to campaign successfully',
      data: campaign,
      code: 200,
    };
  } catch (error) {
    console.error('Error adding product to campaign:', error);
    return {
      message: 'Failed to add product to campaign',
      data: null,
      code: 500,
    };
  }
};

const removeProductFromCampaign = async (
  campaignId: string,
  productId: string
): Promise<CustomResponseType<ICampaign>> => {
  try {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return {
        message: 'Campaign not found',
        data: null,
        code: 404,
      };
    }

    // Remove product from campaign
    const current = campaign.products as unknown as Types.ObjectId[];
    campaign.products = current.filter((p) => p.toString() !== productId) as unknown as ICampaign['products'];

    await campaign.save();
    await campaign.populate([
      { path: 'products', select: 'name price description slug status' },
      { path: 'sales', select: 'title type startDate endDate isActive' },
    ]);

    return {
      message: 'Product removed from campaign successfully',
      data: campaign,
      code: 200,
    };
  } catch (error) {
    console.error('Error removing product from campaign:', error);
    return {
      message: 'Failed to remove product from campaign',
      data: null,
      code: 500,
    };
  }
};

const CampaignService = {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  toggleCampaignStatus,
  addProductToCampaign,
  removeProductFromCampaign,
};

export default CampaignService;
