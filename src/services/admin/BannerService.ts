import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import Banner, { BannerType } from '../../models/Banner';

// Banner input types
interface CreateBannerInput {
  name: string;
  imageUrl: string;
  pageLink: string;
  active?: boolean;
  category: 'A' | 'B' | 'C' | 'D' | 'E';
  position?: number;
  supportingText?: string | null;
  ctaColor?: string;
}

interface SearchBannerInput {
  name?: string;
  active?: string;
  category?: string;
  page?: number;
  limit?: number;
}

/**
 * Creates a new banner.
 * @param bannerData - The data for the banner.
 * @returns A promise that resolves to a custom response containing the created banner.
 */
const createBanner = async (bannerData: CreateBannerInput): Promise<CustomResponseType<BannerType>> => {
  try {
    const banner = new Banner(bannerData);
    await banner.save();

    return {
      message: 'Banner created successfully',
      data: banner,
      code: 201,
    };
  } catch (error) {
    console.log('Error creating banner:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to create banner',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates an existing banner.
 * @param bannerId - The ID of the banner to update.
 * @param bannerData - The new data for the banner.
 * @returns A promise that resolves to a custom response containing the updated banner.
 */
const updateBanner = async (
  bannerId: string,
  bannerData: Partial<CreateBannerInput>
): Promise<CustomResponseType<BannerType>> => {
  try {
    const updatedBanner = await Banner.findByIdAndUpdate(
      bannerId,
      bannerData,
      { new: true } // To return the updated document
    );

    if (!updatedBanner) {
      return {
        message: 'Banner not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Banner updated successfully',
      data: updatedBanner,
      code: 200,
    };
  } catch (error) {
    console.log('Error updating banner:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to update banner',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a banner.
 * @param bannerId - The ID of the banner to delete.
 * @returns A promise that resolves to a custom response.
 */
const deleteBanner = async (bannerId: string): Promise<CustomResponseType<null>> => {
  try {
    const banner = await Banner.findByIdAndDelete(bannerId);

    if (!banner) {
      return {
        message: 'Banner not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Banner deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log('Error deleting banner:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to delete banner',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets a banner by ID.
 * @param bannerId - The ID of the banner to retrieve.
 * @returns A promise that resolves to a custom response containing the banner.
 */
const getBannerById = async (bannerId: string): Promise<CustomResponseType<BannerType>> => {
  try {
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return {
        message: 'Banner not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Banner fetched successfully',
      data: banner,
      code: 200,
    };
  } catch (error) {
    console.log('Error fetching banner:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch banner',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets all banners with filtering options.
 * @param searchParams - Optional search parameters.
 * @returns A promise that resolves to a custom response containing banners and total count.
 */
const getBanners = async (
  searchParams?: SearchBannerInput
): CustomResponseTypeWithMeta<
  { banners: BannerType[] },
  { page: number; limit: number; total: number; pages: number }
> => {
  try {
    const { name, active, page = 1, limit = 10 } = searchParams || {};

    // Build query filters
    const filter: Record<string, unknown> = {};

    if (name) {
      // Escape regex special chars to avoid ReDoS / unintended patterns
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }

    if (active !== undefined) {
      if (active === 'active') {
        filter.active = true;
      } else {
        filter.active = false;
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [banners, total] = await Promise.all([
      Banner.find(filter).skip(skip).limit(limit).sort({ position: 1, createdAt: -1 }),
      Banner.countDocuments(filter),
    ]);

    return {
      message: 'Banners fetched successfully',
      data: { banners },
      code: 200,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    console.log('Error fetching banners:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch banners',
      data: { banners: [] },
      code: 500,
      meta: { page: 1, limit: 0, total: 0, pages: 0 },
    };
  }
};

/**
 * Toggle the active status of a banner.
 * @param bannerId - The ID of the banner to update.
 * @returns A promise that resolves to a custom response containing the updated banner.
 */
const toggleBannerActive = async (bannerId: string): Promise<CustomResponseType<BannerType>> => {
  try {
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return {
        message: 'Banner not found',
        data: null,
        code: 404,
      };
    }

    banner.active = !banner.active;
    await banner.save();

    return {
      message: `Banner ${banner.active ? 'activated' : 'deactivated'} successfully`,
      data: banner,
      code: 200,
    };
  } catch (error) {
    console.log('Error toggling banner status:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to toggle banner status',
      data: null,
      code: 500,
    };
  }
};

const BannerService = {
  createBanner,
  updateBanner,
  deleteBanner,
  getBannerById,
  getBanners,
  toggleBannerActive,
};

export default BannerService;
