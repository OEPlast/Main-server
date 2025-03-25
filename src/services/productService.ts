import Product, { ProductType } from '../models/Product';
import { CustomResponseType } from '../types';

/**
 * Fetches all products with optional filters.
 * @param filters - The filters to apply (e.g., category, price).
 */
const getAllProducts = async (filters: Partial<ProductType>): Promise<CustomResponseType<ProductType[]>> => {
  try {
    const products = await Product.find(filters);
    return {
      message: 'Products retrieved successfully',
      data: products,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      message: 'Failed to fetch products',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches a product by its ID.
 * @param productId - The ID of the product.
 */
const getProductById = async (productId: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Product retrieved successfully',
      data: product,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    return {
      message: 'Failed to fetch product',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets the total stock of a product.
 * @param productId - The ID of the product.
 */
const getProductStock = async (productId: string): Promise<CustomResponseType<number>> => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Product stock retrieved successfully',
      data: product.stock,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching product stock:', error);
    return {
      message: 'Failed to fetch product stock',
      data: null,
      code: 500,
    };
  }
};

const ProductService = { getAllProducts, getProductById, getProductStock };
export default ProductService;
