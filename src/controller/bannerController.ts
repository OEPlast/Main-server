import { Request, Response } from 'express';
import BannerService from '../services/admin/BannerService';

// Get all banners with optional filtering - for general use
const getBanners = async (req: Request, res: Response) => {
  try {
    // Only get active banners for general routes
    const searchParams = {
      name: req.query.name as string | undefined,
      active: req.query.status ? req.query.status.toString() : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const { data, meta, code, message } = await BannerService.getBanners(searchParams);
    return res.status(code).json({ data, meta, message });
  } catch (error) {
    console.error('Error in getBanners:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const BannerController = {
  getBanners,
};

export default BannerController;
