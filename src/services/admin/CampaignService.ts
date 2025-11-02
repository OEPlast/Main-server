import Campaign, { ICampaign } from '../../models/Campaign';
import { Types } from 'mongoose';
import { CustomResponseType } from '@/types';
import { buildUpdateQuery } from '@/helpers/query';
// Helper: detect duplicate key (Mongo 11000) across Mongoose/Mongo errors
const isDuplicateKeyError = (err: unknown): boolean => {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: number; keyPattern?: Record<string, number> };
  return e.code === 11000 || (e.keyPattern && e.keyPattern.slug === 1) || false;
};

const createCampaign = async (campaignData: {
  slug: string;
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
      slug: campaignData.slug?.trim().toLowerCase(),
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
    if (isDuplicateKeyError(error)) {
      return { message: 'Slug already exists', data: null, code: 409 };
    }
    return { message: 'Failed to create campaign', data: null, code: 500 };
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
    const updatesFiltered: Partial<ICampaign> = {
      slug: updates.slug ? (updates.slug as unknown as string).trim().toLowerCase() : undefined,
      image: updates.image,
      title: updates.title,
      description: updates.description,
      status: updates.status,
      startDate: updates.startDate ?? null,
      endDate: updates.endDate ?? null,
      products: updates.products,
      sales: updates.sales,
    };

    const updateQuery = buildUpdateQuery(updatesFiltered);

    // If no updates, return error
    if (Object.keys(updateQuery).length === 0) {
      return {
        message: 'No valid fields to update',
        data: null,
        code: 400,
      };
    }

    const campaign = await Campaign.findByIdAndUpdate(campaignId, updateQuery, { new: true, runValidators: true })
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
    const dup = isDuplicateKeyError(error);
    return {
      message: dup ? 'Slug already exists' : 'Failed to update campaign',
      data: null,
      code: dup ? 409 : 500,
    };
  }
};

const checkSlugAvailability = async (
  slug: string,
  excludeId?: string
): Promise<CustomResponseType<{ available: boolean }>> => {
  try {
    const normalized = slug.trim().toLowerCase();
    const query: { slug: string; _id?: { $ne: string } } = { slug: normalized };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const exists = await Campaign.exists(query);
    return { message: 'OK', data: { available: !exists }, code: 200 };
  } catch (error) {
    console.error('Error checking slug availability:', error);
    return { message: 'Failed to check slug', data: null, code: 500 };
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

type CampaignListItem = ICampaign & { productsCount: number; salesCount: number };

const getCampaignsList = async (
  status?: string
): Promise<CustomResponseType<{ campaigns: CampaignListItem[]; total: number }>> => {
  try {
    const filter = status ? { status } : {};

    // Minimal projection - only fields needed for list view (no population)
    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .select('_id slug image title status createdAt updatedAt products sales')
        .sort({ createdAt: -1 }),
      Campaign.countDocuments(filter),
    ]);

    // Calculate counts without population for better performance
    const campaignsWithCounts = campaigns.map((campaign) => ({
      ...campaign.toObject(),
      productsCount: campaign.products?.length || 0,
      salesCount: campaign.sales?.length || 0,
    }));

    return {
      message: 'Campaigns list retrieved successfully',
      data: { campaigns: campaignsWithCounts, total },
      code: 200,
    };
  } catch (error) {
    console.error('Error getting campaigns list:', error);
    return {
      message: 'Failed to retrieve campaigns list',
      data: null,
      code: 500,
    };
  }
};

const CampaignService = {
  createCampaign,
  getAllCampaigns,
  getCampaignsList,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  toggleCampaignStatus,
  addProductToCampaign,
  removeProductFromCampaign,
  checkSlugAvailability,
};

export default CampaignService;
