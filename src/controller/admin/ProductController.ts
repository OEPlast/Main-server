import { Request, Response } from 'express';
import Admin_ProductService from '../../services/admin/Product';

// Search products
const updateCoverImage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;

    const { data, code, message } = await Admin_ProductService.updateCoverImage(id, imageUrl);
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
    const { data, code, message } = await Admin_ProductService.getProductById(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getProductById:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Duplicate product
const duplicateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, message, code } = await Admin_ProductService.duplicateProduct(id);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in addProduct:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update product details
const updateProduct = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const productData = req.body;
    const { data, message, code } = await Admin_ProductService.updateProduct(productId, productData);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateProduct:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a product
const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { message, code } = await Admin_ProductService.deleteProduct(productId);
    res.status(code).json({ message });
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a product
const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      brand,
      price,
      category,
      subCategories,
      description_images,
      specifications,
      shipping,
      deliveryTime,
      attributes,
      tags,
      stock,
      discount,
    } = req.body;
    const { message, code, data } = await Admin_ProductService.createProduct({
      name,
      description,
      brand,
      price,
      category,
      subCategories,
      description_images,
      specifications,
      shipping,
      deliveryTime,
      attributes,
      tags,
      stock,
      discount,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const Admin_ProductController = {
  createProduct,
  updateCoverImage,
  getProductById,
  duplicateProduct,
  updateProduct,
  deleteProduct,
};
export default Admin_ProductController;
