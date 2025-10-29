import { Request, Response } from 'express';
import ProductService from '../services/productService';

// Get all products
const getAllProducts = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const subcategory = req.query.subcategory ? String(req.query.subcategory) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const minPrice = req.query.minPrice != null ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPrice = req.query.maxPrice != null ? parseFloat(String(req.query.maxPrice)) : undefined;
    const brand = req.query.brand ? String(req.query.brand) : undefined;
    const sortBy = (req.query.sortBy as 'price' | 'name' | 'createdAt' | 'rating' | 'sales' | undefined) ?? undefined;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc' | undefined) ?? undefined;
    const availability = (req.query.availability as 'in-stock' | 'out-of-stock' | 'low-stock' | undefined) ?? undefined;
    const specKey = req.query.specKey ? String(req.query.specKey) : undefined;
    const specValue = req.query.specValue ? String(req.query.specValue) : undefined;

    const { data, message, code, meta } = await ProductService.getAllProducts({
      page,
      limit,
      category,
      subcategory,
      search,
      minPrice,
      maxPrice,
      brand,
      sortBy,
      sortOrder,
      availability,
      specKey,
      specValue,
    });
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Search products
const searchProducts = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const category = req.query.category ? String(req.query.category) : undefined;
    const minPrice = req.query.minPrice != null ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPrice = req.query.maxPrice != null ? parseFloat(String(req.query.maxPrice)) : undefined;
    const brand = req.query.brand ? String(req.query.brand) : undefined;
    const sortBy = (req.query.sortBy as 'price' | 'name' | 'createdAt' | 'rating' | 'sales' | undefined) ?? undefined;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc' | undefined) ?? undefined;
    const specKey = req.query.specKey ? String(req.query.specKey) : undefined;
    const specValue = req.query.specValue ? String(req.query.specValue) : undefined;
    const filters = {
      category,
      minPrice,
      maxPrice,
      brand,
      sortBy,
      sortOrder,
      specKey,
      specValue,
    };

    const { data, message, code, meta } = await ProductService.searchProducts(q, filters, page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in searchProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Enhanced analytics and recommendation functions

// Get products of the week
const getWeekProducts = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const { data, message, code, meta } = await ProductService.getWeekProducts(page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getWeekProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get top sold products
const getTopSoldProducts = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const { data, message, code, meta } = await ProductService.getTopSoldProducts(page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getTopSoldProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get hot sales products
const getHotSalesProducts = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const { data, message, code, meta } = await ProductService.getHotSalesProducts(page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getHotSalesProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get product by ID
const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { data, message, code } = await ProductService.getProductById(id);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get products recommended based off the current product ID
const getRecommendation = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const { data, message, code, meta } = await ProductService.recommendBasedOnCurrentProduct(productId, page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getProductById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get product recommendations for a user (personalized)
const getProductRecommendations = async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || '';
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const { data, message, code, meta } = await ProductService.getProductRecommendations(userId, page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getProductRecommendations:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
const getByCategorySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sort = (req.query.sort as 'newest' | 'price_asc' | 'price_desc' | 'popular') || 'newest';
    const { data, message, code, meta } = await ProductService.getByCategorySlug(slug, page, limit, sort);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getByCategorySlug:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
const getProductBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params as { slug: string };
    const { data, message, code } = await ProductService.getProductBySlug(slug);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductBySlug:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get top categories by sales volume
const getTopCategories = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const { data, message, code } = await ProductService.getTopCategories(limit);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTopCategories:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getAllProducts,
  searchProducts,
  getWeekProducts,
  getTopSoldProducts,
  getHotSalesProducts,
  getProductRecommendations,
  getByCategorySlug,
  getProductBySlug,
  getProductById,
  getRecommendation,
  getTopCategories,
};
