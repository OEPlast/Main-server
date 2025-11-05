import Campaign, { ICampaign } from '@/models/Campaign';
import { CustomResponseType } from '@/types';
import mongoose, { FilterQuery } from 'mongoose';

type ListInput = { page: number; limit: number; q?: string };
type BySlugInput = { slug: string };
type ByIdInput = { campaignId: string };

/**
 * Get all active campaigns with pagination
 */
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

/**
 * Get campaign by ID (metadata only)
 */
const getActiveCampaignById = async ({ campaignId }: ByIdInput): Promise<CustomResponseType<ICampaign>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return { message: 'Invalid campaign id', data: null, code: 400 };
    }

    const campaign = await Campaign.findOne({ _id: campaignId, status: 'active' }).lean();
    if (!campaign) {
      return { message: 'Campaign not found or inactive', data: null, code: 404 };
    }

    return {
      message: 'Campaign retrieved successfully',
      data: campaign,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching campaign by id:', error);
    return { message: 'Failed to retrieve campaign', data: null, code: 500 };
  }
};

/**
 * Get campaign by slug (metadata only)
 * Normalizes slug from URL (hyphens) to DB format (underscores)
 * Validates date range if specified
 */
const getActiveCampaignBySlug = async ({ slug }: BySlugInput): Promise<CustomResponseType<ICampaign>> => {
  try {
    // Normalize slug: convert hyphens to underscores for DB query
    const normalized = slug.trim().toLowerCase();

    // Fetch campaign metadata only
    const campaign = await Campaign.findOne({ slug: normalized, status: 'active' }).lean();

    if (!campaign) {
      return { message: 'Campaign not found or inactive', data: null, code: 404 };
    }

    // Validate date range if dates exist
    if (campaign.startDate && campaign.endDate) {
      const now = new Date();
      const start = new Date(campaign.startDate);
      const end = new Date(campaign.endDate);

      if (now < start || now > end) {
        return { message: 'Campaign not found or inactive', data: null, code: 404 };
      }
    }

    return {
      message: 'Campaign retrieved successfully',
      data: campaign,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching campaign by slug:', error);
    return { message: 'Failed to retrieve campaign', data: null, code: 500 };
  }
};

export default {
  getAllActiveCampaigns,
  getActiveCampaignById,
  getActiveCampaignBySlug,
  getCampaignFilters,
};

/**
 * Get filters for a campaign's products
 * Returns dynamic filters based on all products in the campaign
 * @param slug - Campaign slug (converts hyphens to underscores)
 */
async function getCampaignFilters(slug: string): Promise<
  CustomResponseType<{
    priceRange: { min: number; max: number };
    attributes: Array<{ name: string; values: Array<{ value: string; count: number; colorCode?: string }> }>;
    specifications: Array<{ key: string; values: Array<{ value: string; count: number }> }>;
    tags: Array<{ value: string; count: number }>;
    packSizes: Array<{ label: string; count: number }>;
  }>
> {
  try {
    const Product = mongoose.model('Product');

    // Normalize slug: convert hyphens to underscores for DB query
    const normalized = slug.trim().toLowerCase();

    // Find campaign and get product IDs
    const campaign = await Campaign.findOne({ slug: normalized, status: 'active' })
      .select('products startDate endDate')
      .lean();

    if (!campaign) {
      return { message: 'Campaign not found or inactive', data: null, code: 404 };
    }

    // Validate date range if dates exist
    if (campaign.startDate && campaign.endDate) {
      const now = new Date();
      const start = new Date(campaign.startDate);
      const end = new Date(campaign.endDate);

      if (now < start || now > end) {
        return { message: 'Campaign not found or inactive', data: null, code: 404 };
      }
    }

    // Build filter aggregation pipeline on Product collection
    const pipeline: mongoose.PipelineStage[] = [
      // Match products in campaign
      { $match: { _id: { $in: campaign.products }, status: 'active' } },

      // Build filters using $facet
      {
        $facet: {
          price: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],

          // Attributes aggregation
          attributes: [
            { $unwind: { path: '$attributes', preserveNullAndEmptyArrays: false } },
            { $unwind: { path: '$attributes.children', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { name: '$attributes.name', value: '$attributes.children.name' },
                count: { $sum: 1 },
                colorCode: { $first: '$attributes.children.colorCode' },
              },
            },
            {
              $group: {
                _id: '$_id.name',
                values: {
                  $push: { value: '$_id.value', count: '$count', colorCode: '$colorCode' },
                },
              },
            },
            { $project: { _id: 0, name: '$_id', values: 1 } },
          ],

          // Specifications aggregation
          specifications: [
            { $unwind: { path: '$specifications', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { key: '$specifications.key', value: '$specifications.value' },
                count: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: '$_id.key',
                values: { $push: { value: '$_id.value', count: '$count' } },
              },
            },
            { $project: { _id: 0, key: '$_id', values: 1 } },
          ],

          // Tags aggregation
          tags: [
            { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $project: { _id: 0, value: '$_id', count: 1 } },
          ],

          // Pack sizes
          packSizes: [
            { $unwind: { path: '$packSizes', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$packSizes.label', count: { $sum: 1 } } },
            { $project: { _id: 0, label: '$_id', count: 1 } },
          ],
        },
      },

      // Project final structure
      {
        $project: {
          priceRange: {
            min: { $ifNull: [{ $arrayElemAt: ['$price.min', 0] }, 0] },
            max: { $ifNull: [{ $arrayElemAt: ['$price.max', 0] }, 0] },
          },
          attributes: 1,
          specifications: 1,
          tags: 1,
          packSizes: 1,
        },
      },
    ];

    const agg = await Product.aggregate(pipeline).allowDiskUse(true);
    const payload = agg[0] || {
      priceRange: { min: 0, max: 0 },
      attributes: [],
      specifications: [],
      tags: [],
      packSizes: [],
    };

    return { message: 'Filters retrieved successfully', data: payload, code: 200 };
  } catch (error) {
    console.error('Error building campaign filters:', error);
    return { message: 'Failed to retrieve campaign filters', data: null, code: 500 };
  }
}
