import { Request, Response } from 'express';
import BannerService from '../../services/admin/BannerService';

// Get all banners with optional filtering
const getBanners = async (req: Request, res: Response) => {
  try {
    // Get query parameters
    const searchParams = {
      name: req.query.name as string | undefined,
      active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
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

// Get a banner by ID
const getBannerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await BannerService.getBannerById(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getBannerById:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Create a new banner
const createBanner = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await BannerService.createBanner(req.body);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in createBanner:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update an existing banner
const updateBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await BannerService.updateBanner(id, req.body);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in updateBanner:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete a banner
const deleteBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await BannerService.deleteBanner(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteBanner:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Toggle banner active status
const toggleBannerActive = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await BannerService.toggleBannerActive(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in toggleBannerActive:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const Admin_BannerController = {
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerActive,
};

export default Admin_BannerController;
