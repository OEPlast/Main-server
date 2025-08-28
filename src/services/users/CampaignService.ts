import Campaign, { ICampaign } from '@/models/Campaign';
import Product, { ProductType } from '@/models/Product';
import { CustomResponseType } from '@/types';
import mongoose, { FilterQuery, Types } from 'mongoose';

type ListInput = { page: number; limit: number; q?: string };
type ByIdInput = { campaignId: string; page: number; limit: number };

const getAllActiveCampaigns = async ({
  page,
  limit,
  q,
}: ListInput): Promise<CustomResponseType<{ campaigns: ICampaign[]; total: number; page: number; limit: number }>> => {
  try {
    const filter: FilterQuery<ICampaign> = { status: 'active' } as FilterQuery<ICampaign>;
    if (q) filter.title = new RegExp(q, 'i');

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Campaign.countDocuments(filter),
    ]);

    return {
      message: 'Active campaigns retrieved successfully',
      data: { campaigns, total, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching active campaigns:', error);
    return { message: 'Failed to retrieve campaigns', data: null, code: 500 };
  }
};

const getActiveCampaignById = async ({
  campaignId,
  page,
  limit,
}: ByIdInput): Promise<
  CustomResponseType<{
    campaign: ICampaign;
    products: ProductType[];
    total: number;
    page: number;
    limit: number;
    sales: ICampaign['sales'];
  }>
> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return { message: 'Invalid campaign id', data: null, code: 400 };
    }

    // Fetch base doc to get unpopulated product IDs for accurate total count
    const baseDoc = await Campaign.findOne({ _id: campaignId, status: 'active' });
    if (!baseDoc) {
      return { message: 'Campaign not found or inactive', data: null, code: 404 };
    }

    const productIds = (baseDoc.products as unknown as Types.ObjectId[]) ?? [];
    const total = await Product.countDocuments({ _id: { $in: productIds }, status: 'active' });

    // Populate paginated products and all sales
    await baseDoc.populate([
      {
        path: 'products',
        match: { status: 'active' },
        options: { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit },
      },
      {
        path: 'sales',
        options: { sort: { createdAt: -1 } },
      },
    ]);

    const campaign = baseDoc.toObject() as ICampaign;
    const products = (campaign.products as unknown as ProductType[]) ?? [];
    const sales = campaign.sales ?? [];

    return {
      message: 'Campaign retrieved successfully',
      data: { campaign, products, sales, total, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching campaign by id:', error);
    return { message: 'Failed to retrieve campaign', data: null, code: 500 };
  }
};

export default { getAllActiveCampaigns, getActiveCampaignById };
