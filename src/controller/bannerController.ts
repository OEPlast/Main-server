import { Request, Response } from 'express';
import BannerService from '../services/admin/BannerService';

// Get all banners with optional filtering - for general use
const getBanners = async (req: Request, res: Response) => {
  try {
    // Only get active banners for general routes
    const searchParams = {
      name: req.query.name as string | undefined,
      active: true, // Only return active banners for public access
      category: req.query.category as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const { data, code, message } = await BannerService.getBanners(searchParams);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getBanners:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const BannerController = {
  getBanners,
};

export default BannerController;
