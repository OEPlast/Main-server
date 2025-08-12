import Campaign, { ICampaign } from '../../models/Campaign';
import { CustomResponseType } from '@/types';

const createCampaign = async (campaignData: {
  title: string;
  description?: string;
  image: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'inactive' | 'draft';
  products?: Array<{
    productId: string;
    discount: {
      type: 'percentage' | 'fixed';
      value: number;
    };
  }>;
  sales?: Array<{
    saleId: string;
    name: string;
    discount: number;
    type: 'flash' | 'limited' | 'clearance';
  }>;
}): Promise<CustomResponseType<ICampaign>> => {
  try {
    const campaign = new Campaign({
      ...campaignData,
      totalProducts: campaignData.products?.length || 0,
      totalSales: campaignData.sales?.length || 0,
      averagePrice: 0, // Will be calculated based on products
      maxDiscount: Math.max(
        ...(campaignData.products?.map((p) => p.discount.value) || [0]),
        ...(campaignData.sales?.map((s) => s.discount) || [0])
      ),
    });

    await campaign.save();
    await campaign.populate('products.productId sales.saleId');

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
  page = 1,
  limit = 20,
  status?: string
): Promise<CustomResponseType<{ campaigns: ICampaign[]; total: number; page: number; limit: number }>> => {
  try {
    const filter = status ? { status } : {};

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate('products.productId', 'name price images')
        .populate('sales.saleId', 'name discountType discountValue')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Campaign.countDocuments(filter),
    ]);

    return {
      message: 'Campaigns retrieved successfully',
      data: { campaigns, total, page, limit },
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
      .populate('products.productId', 'name price images description')
      .populate('sales.saleId', 'name discountType discountValue startDate endDate');

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
    // Recalculate totals if products or sales are updated
    if (updates.products || updates.sales) {
      updates.totalProducts = updates.products?.length || 0;
      updates.totalSales = updates.sales?.length || 0;

      const productDiscounts: number[] = (updates.products ?? []).map((p: ICampaign['products'][number] | undefined) =>
        p && p.discount && typeof p.discount.value === 'number' ? p.discount.value : 0
      );
      const saleDiscounts: number[] = (updates.sales ?? []).map((s: ICampaign['sales'][number] | undefined) =>
        s && typeof s.discount === 'number' ? s.discount : 0
      );

      updates.maxDiscount = Math.max(
        ...(productDiscounts.length ? productDiscounts : [0]),
        ...(saleDiscounts.length ? saleDiscounts : [0])
      );
    }

    const campaign = await Campaign.findByIdAndUpdate(campaignId, updates, { new: true })
      .populate('products.productId', 'name price images')
      .populate('sales.saleId', 'name discountType discountValue');

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
    const campaign = await Campaign.findByIdAndUpdate(campaignId, { status }, { new: true }).populate(
      'products.productId sales.saleId'
    );

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

const addProductToCampaign = async (
  campaignId: string,
  productData: {
    productId: string;
    discount: {
      type: 'percentage' | 'fixed';
      value: number;
    };
  }
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

    // Check if product already exists in campaign
    const existingProduct = campaign.products.find(
      (p: ICampaign['products'][number]) => p.productId.toString() === productData.productId
    );

    if (existingProduct) {
      return {
        message: 'Product already exists in campaign',
        data: null,
        code: 400,
      };
    }

    campaign.products.push(productData as unknown as ICampaign['products'][number]);
    campaign.totalProducts = campaign.products.length;
    campaign.maxDiscount = Math.max(campaign.maxDiscount, productData.discount.value);

    await campaign.save();
    await campaign.populate('products.productId sales.saleId');

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
    const productIndex = campaign.products.findIndex(
      (p: ICampaign['products'][number]) => p.productId.toString() === productId
    );
    if (productIndex > -1) {
      campaign.products.splice(productIndex, 1);
    }
    campaign.totalProducts = campaign.products.length;

    await campaign.save();
    await campaign.populate('products.productId sales.saleId');

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
