import { Request, Response } from 'express';
import UserBannerService from '@/services/UserBannerService';


const getAllBanners = async (req: Request, res: Response) => {
  try {
    const category = req.query.category as 'A' | 'B' | 'C' | 'D' | 'E' | undefined;

    const { data, code, message } = await UserBannerService.getAllBanners({ category });

    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in UserBannerController.getAllBanners:', error);
    return res.status(500).json({ 
      message: 'Something went wrong while fetching banners',
      data: null,
      meta: { total: 0 },
    });
  }
};

/**
 * Get banners grouped by all categories
 * Returns an object with categories as keys and banner arrays as values
 * 
 * Example request:
 *   GET /user/banners/grouped
 * 
 * Example response:
 *   {
 *     data: {
 *       A: [...banners],
 *       B: [...banners],
 *       C: [...banners],
 *       D: [...banners],
 *       E: [...banners]
 *     },
 *     meta: { total: 25 }
 *   }
 */
const getBannersGrouped = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await UserBannerService.getBannersByAllCategories();

    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in UserBannerController.getBannersGrouped:', error);
    return res.status(500).json({ 
      message: 'Something went wrong while fetching grouped banners',
      data: null,
      meta: { total: 0 },
    });
  }
};

const UserBannerController = {
  getAllBanners,
  getBannersGrouped,
};

export default UserBannerController;
