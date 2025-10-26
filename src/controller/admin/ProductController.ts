import { Request, Response } from 'express';
import Admin_ProductService from '../../services/admin/Product';

// Search products
const updateCoverImage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { imageId } = req.body;

    const { data, code, message } = await Admin_ProductService.updateCoverImage(id, imageId);
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
  async getAllProducts(req: Request, res: Response) {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const category = req.query.category ? String(req.query.category) : undefined;
      const subcategory = req.query.subcategory ? String(req.query.subcategory) : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;
      const minPrice = req.query.minPrice != null ? parseFloat(String(req.query.minPrice)) : undefined;
      const maxPrice = req.query.maxPrice != null ? parseFloat(String(req.query.maxPrice)) : undefined;
      const sortBy = (req.query.sortBy as 'price' | 'name' | 'createdAt' | 'rating' | 'sales' | undefined) ?? undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc' | undefined) ?? undefined;
      const availability =
        (req.query.availability as 'in-stock' | 'out-of-stock' | 'low-stock' | undefined) ?? undefined;
      const brand = req.query.brand ? String(req.query.brand) : undefined;

      const specKey = req.query.specKey ? String(req.query.specKey) : undefined;
      const specValue = req.query.specValue ? String(req.query.specValue) : undefined;

      const { data, message, code, meta } = await Admin_ProductService.getAllProducts({
        page,
        limit,
        category,
        subcategory,
        search,
        minPrice,
        maxPrice,
        sortBy,
        sortOrder,
        availability,
        specKey,
        specValue,
        brand,
      });
      return res.status(code).json({ message, data, meta });
    } catch (error) {
      console.error('Error in admin getAllProducts:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  async getAllProductsEnhanced(req: Request, res: Response) {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const category = req.query.category ? String(req.query.category) : undefined;
      const subcategory = req.query.subcategory ? String(req.query.subcategory) : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;
      const minPrice = req.query.minPrice != null ? parseFloat(String(req.query.minPrice)) : undefined;
      const maxPrice = req.query.maxPrice != null ? parseFloat(String(req.query.maxPrice)) : undefined;
      const sortBy = (req.query.sortBy as 'price' | 'name' | 'createdAt' | 'rating' | 'sales' | undefined) ?? undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc' | undefined) ?? undefined;
      const availability =
        (req.query.availability as 'in-stock' | 'out-of-stock' | 'low-stock' | undefined) ?? undefined;
      const brand = req.query.brand ? String(req.query.brand) : undefined;

      const specKey = req.query.specKey ? String(req.query.specKey) : undefined;
      const specValue = req.query.specValue ? String(req.query.specValue) : undefined;

      const { data, message, code, meta } = await Admin_ProductService.getAllProductsEnhanced({
        page,
        limit,
        category,
        subcategory,
        search,
        minPrice,
        maxPrice,
        sortBy,
        sortOrder,
        availability,
        specKey,
        specValue,
        brand,
      });
      return res.status(code).json({ message, data, meta });
    } catch (error) {
      console.error('Error in admin getAllProductsEnhanced:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  async checkSkuExists(req: Request, res: Response) {
    try {
      const { sku } = req.params;
      const skuNumber = parseInt(sku, 10);

      if (isNaN(skuNumber)) {
        return res.status(400).json({ message: 'Invalid SKU format', data: null });
      }

      const { data, message, code } = await Admin_ProductService.checkSkuExists(skuNumber);
      return res.status(code).json({ message, data });
    } catch (error) {
      console.error('Error in checkSkuExists:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async checkSlugAvailable(req: Request, res: Response) {
    try {
      const { slug, excludeId } = req.query;

      if (!slug || typeof slug !== 'string') {
        return res.status(400).json({ message: 'Slug is required', data: null });
      }

      const { data, message, code } = await Admin_ProductService.checkSlugAvailable(
        slug,
        excludeId as string | undefined
      );
      return res.status(code).json({ message, data });
    } catch (error) {
      console.error('Error in checkSlugAvailable:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getProductListMinimal(req: Request, res: Response) {
    try {
      const { data, message, code } = await Admin_ProductService.getProductListMinimal();
      return res.status(code).json({ message, data });
    } catch (error) {
      console.error('Error in getProductListMinimal:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

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
