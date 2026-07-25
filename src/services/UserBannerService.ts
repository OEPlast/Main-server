import Banner, { BannerType } from '@/models/Banner';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';

interface GetUserBannersParams {
  category?: 'A' | 'B' | 'C' | 'D' | 'E';
}

  /**
   * Get all active banners with optional category filtering
   * @param params - Optional category filter
   * @returns Active banners sorted by position (ascending)
   */
  const getAllBanners = async (params: GetUserBannersParams = {}): Promise<CustomResponseType<BannerType[]>> => {
    try {
      const { category } = params;

      // Build query - always filter for active banners
      const query: any = { active: true };

      // Add category filter if provided
      if (category) {
        query.category = category;
      }

      // Get banners sorted by position (ascending) and creation date (newest first)
      const banners = await Banner.find(query)
        .select('name imageUrl pageLink category position createdAt headerText mainText supportingText CTA ctaColor fullImage')
        .sort({ position: 1, createdAt: -1 });


      return {
        message: category 
          ? `Active banners in category ${category} retrieved successfully`
          : 'All active banners retrieved successfully',
        data: banners as BannerType[],
        code: 200,
      };
    } catch (error) {
      console.error('Error in UserBannerService.getAllBanners:', error);
      return {
        message: 'Failed to retrieve banners',
        data: null,
        code: 500,
      };
    }
  };

  /**
   * Get active banners grouped by category
   * @returns Banners grouped by category (A, B, C, D, E)
   */
  const getBannersByAllCategories = async (): Promise<CustomResponseType<Record<string, BannerType[]>>>  =>{
    try {
      // Get all active banners
      const banners = await Banner.find({ active: true })
        .select('name imageUrl pageLink category position createdAt headerText mainText supportingText CTA ctaColor fullImage')
        .sort({ position: 1, createdAt: -1 });

      // Group by category
      const groupedBanners: Record<string, BannerType[]> = {
        A: [],
        B: [],
        C: [],
        D: [],
        E: [],
      };

      banners.forEach((banner) => {
        if (banner.category && groupedBanners[banner.category]) {
          groupedBanners[banner.category].push(banner as BannerType);
        }
      });

      const total = banners.length;

      return {
        message: 'Banners grouped by category retrieved successfully',
        data: groupedBanners,
        code: 200,
      };
    } catch (error) {
      console.error('Error in UserBannerService.getBannersByAllCategories:', error);
      return {
        message: 'Failed to retrieve grouped banners',
        data: null,
        code: 500,
      };
    }
  };


  const UserBannerService = {
    getAllBanners,
    getBannersByAllCategories,
  };
export default UserBannerService;
