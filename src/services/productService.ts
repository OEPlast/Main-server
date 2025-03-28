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
/**
 * Searches for products based on a query string with optional filters and pagination.
 * @param query - The search query.
 * @param filters - The filters to apply (e.g., price range, category, attributes).
 * @param page - The page number for pagination.
 * @param limit - The number of products per page.
 */
const searchProducts = async (
  query: string,
  filters: {
    priceRange?: { min: number; max: number };
    category?: string;
    attributes?: Record<string, string | number | boolean>;
  },
  page: number = 1,
  limit: number = 10
): Promise<CustomResponseType<{ products: ProductType[]; meta: { total: number; page: number; limit: number } }>> => {
  try {
    const { priceRange, category, attributes } = filters;
    const filterConditions: Record<string, unknown> = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } },
      ],
    };

    if (priceRange) {
      filterConditions.price = { $gte: priceRange.min, $lte: priceRange.max };
    }

    if (category) {
      filterConditions.category = category;
    }

    if (attributes) {
      filterConditions.attributes = { $elemMatch: attributes };
    }

    const products = await Product.find(filterConditions)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments(filterConditions);

    return {
      message: 'Products retrieved successfully',
      data: {
        products,
        meta: {
          total,
          page,
          limit,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return {
      message: 'Failed to search products',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches products paginated by category and subcategory.
 * @param category - The category ID.
 * @param subCategory - The subcategory ID (optional).
 * @param page - The page number for pagination.
 * @param limit - The number of products per page.
 */
const getProductsByCategoryAndSubCategory = async (
  category: string,
  subCategory: string | null,
  page: number = 1,
  limit: number = 10
): Promise<CustomResponseType<{ products: ProductType[]; meta: { total: number; page: number; limit: number } }>> => {
  try {
    const filterConditions: Record<string, unknown> = { category };

    if (subCategory) {
      filterConditions.subCategories = subCategory;
    }

    const products = await Product.find(filterConditions)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments(filterConditions);

    return {
      message: 'Products retrieved successfully',
      data: {
        products,
        meta: {
          total,
          page,
          limit,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching products by category and subcategory:', error);
    return {
      message: 'Failed to fetch products',
      data: null,
      code: 500,
    };
  }
};

const ProductService = {
  getAllProducts,
  getProductById,
  getProductStock,
  searchProducts,
  getProductsByCategoryAndSubCategory,
};
export default ProductService;
