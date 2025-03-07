import { Request, Response } from 'express';
import ProductService from '@/services/admin/Product';

// Get all products
const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;
    const { data, code, message } = await ProductService.getAllProducts(Number(page), Number(limit));
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Search products
const searchProducts = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await ProductService.searchProducts(req.query);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in searchProducts:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get product by ID
const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await ProductService.getProductById(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getProductById:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Create product
const createProduct = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await ProductService.createProduct(req.body);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in createProduct:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update product
const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await ProductService.updateProduct(id, req.body);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in updateProduct:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update sub-product
const addSubProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await ProductService.addSubProduct(id, req.body);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in addSubProduct:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
// Update sub-product
const updateSubProduct = async (req: Request, res: Response) => {
  try {
    const { id, subId } = req.params;
    const { data, code, message } = await ProductService.updateSubProduct(id, subId, req.body);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in updateSubProduct:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete product
const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await ProductService.deleteProduct(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete sub-product
const deleteSubProduct = async (req: Request, res: Response) => {
  try {
    const { id, subId } = req.params;
    const { data, code, message } = await ProductService.deleteSubProduct(id, subId);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteSubProduct:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const ProductController = {
  getAllProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateSubProduct,
  deleteProduct,
  deleteSubProduct,
  addSubProduct,
};
export default ProductController;
