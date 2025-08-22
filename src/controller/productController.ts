import { Request, Response } from 'express';
import ProductService from '../services/productService';

// Get all products
const getAllProducts = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const { data, message, code } = await ProductService.getAllProducts(filters);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Search products
const searchProducts = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const filters = req.body.filters || {};
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { data, message, code } = await ProductService.searchProducts(q, filters, page, limit);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in searchProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Enhanced analytics and recommendation functions

// Get products of the week
const getWeekProducts = async (req: Request, res: Response) => {
  try {
    const { data, message, code } = await ProductService.getWeekProducts();
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getWeekProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get top sold products
const getTopSoldProducts = async (req: Request, res: Response) => {
  try {
    const { data, message, code } = await ProductService.getTopSoldProducts();
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTopSoldProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get hot sales products
const getHotSalesProducts = async (req: Request, res: Response) => {
  try {
    const { data, message, code } = await ProductService.getHotSalesProducts();
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getHotSalesProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get products paginated by category and subcategory
const getProductsByCategoryAndSubCategory = async (req: Request, res: Response) => {
  try {
    const { category, subCat } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { data, message, code } = await ProductService.getProductsByCategoryAndSubCategory(
      category,
      subCat || null,
      page,
      limit
    );

    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductsByCategoryAndSubCategory:', error);
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
    const { data, message, code } = await ProductService.recommendBasedOnCurrentProduct(productId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getAllProducts,
  searchProducts,
  getWeekProducts,
  getTopSoldProducts,
  getHotSalesProducts,
  getProductsByCategoryAndSubCategory,
  async getByCategorySlug(req: Request, res: Response) {
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
  },
  async getProductBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params as { slug: string };
      const { data, message, code } = await ProductService.getProductBySlug(slug);
      return res.status(code).json({ message, data });
    } catch (error) {
      console.error('Error in getProductBySlug:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  getProductById,
  getRecommendation,
};
