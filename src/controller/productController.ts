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
    const { query } = req.query;
    const filters = req.body.filters || {};
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { data, message, code } = await ProductService.searchProducts(query as string, filters, page, limit);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in searchProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get products of the week
const getWeekProducts = async (req: Request, res: Response) => {
  try {
    // Logic to get products of the week
    return res.status(200).json({ message: 'Week products retrieved successfully' });
  } catch (error) {
    console.error('Error in getWeekProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get top sold products
const getTopSoldProducts = async (req: Request, res: Response) => {
  try {
    // Logic to get top sold products
    return res.status(200).json({ message: 'Top sold products retrieved successfully' });
  } catch (error) {
    console.error('Error in getTopSoldProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get hot sales products
const getHotSalesProducts = async (req: Request, res: Response) => {
  try {
    // Logic to get hot sales products
    return res.status(200).json({ message: 'Hot sales products retrieved successfully' });
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
    const { productId } = req.params;
    const { data, message, code } = await ProductService.getProductById(productId);
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
  getProductById,
};
