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
    const { id: productId } = req.params as { id: string };
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
    const { id: productId } = req.params as { id: string };
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
      sku,
      name,
      description,
      brand,
      price,
      category,
      description_images,
      specifications,
      shipping,
      attributes,
      tags,
      stock,
      discount,
    } = req.body;
    const { message, code, data } = await Admin_ProductService.createProduct({
      sku,
      name,
      description,
      brand,
      price,
      category,
      description_images,
      specifications,
      shipping,
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
const addTags = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { tags } = req.body as { tags: string[] };
    const r = await Admin_ProductService.addTags(productId, tags);
    return res.status(r.code).json({ message: r.message, data: r.data });
  } catch (e) {
    console.error('Error in addTags:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
const removeTag = async (req: Request, res: Response) => {
  try {
    const { productId, tag } = req.params as { productId: string; tag: string };
    const r = await Admin_ProductService.removeTag(productId, tag);
    return res.status(r.code).json({ message: r.message, data: r.data });
  } catch (e) {
    console.error('Error in removeTag:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
const addSpecifications = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { specifications } = req.body as { specifications: Array<{ key: string; value: string }> };
    const r = await Admin_ProductService.addSpecifications(productId, specifications);
    return res.status(r.code).json({ message: r.message, data: r.data });
  } catch (e) {
    console.error('Error in addSpecifications:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
const removeSpecification = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { key } = req.body as { key: string };
    const r = await Admin_ProductService.removeSpecification(productId, key);
    return res.status(r.code).json({ message: r.message, data: r.data });
  } catch (e) {
    console.error('Error in removeSpecification:', e);
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
  addTags,
  removeTag,
  addSpecifications,
  removeSpecification,
};
export default Admin_ProductController;
