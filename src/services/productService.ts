import Order from '@/models/Order';
import Product, { ProductType } from '../models/Product';
import { CustomResponseType } from '../types';
import AnalyticsService from './AnalyticsService';

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

    // Track product view for analytics
    // This runs independently and won't affect the response time
    AnalyticsService.trackProductView(productId).catch((err) =>
      console.error('Failed to track product view analytics:', err)
    );

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

/**
 * Fetches products of the week based on orders placed in the last 7 days.
 */
const getWeekProducts = async (): Promise<CustomResponseType<ProductType[]>> => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const weekProducts = await Order.aggregate([
      { $match: { createdAt: { $gte: weekStart }, status: 'Completed' } },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product',
          totalSold: { $sum: '$products.qty' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      { $replaceRoot: { newRoot: '$productDetails' } },
    ]);

    return {
      message: 'Week products retrieved successfully',
      data: weekProducts,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching week products:', error);
    return {
      message: 'Failed to fetch week products',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches top sold products based on total sales from orders.
 */
const getTopSoldProducts = async (): Promise<CustomResponseType<ProductType[]>> => {
  try {
    const topProducts = await Order.aggregate([
      { $match: { status: 'Completed' } },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product',
          totalSold: { $sum: '$products.qty' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      { $replaceRoot: { newRoot: '$productDetails' } },
    ]);

    return {
      message: 'Top sold products retrieved successfully',
      data: topProducts,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching top sold products:', error);
    return {
      message: 'Failed to fetch top sold products',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches hot sales products based on recent orders.
 */
const getHotSalesProducts = async (): Promise<CustomResponseType<ProductType[]>> => {
  try {
    const recentSalesThreshold = new Date();
    recentSalesThreshold.setDate(recentSalesThreshold.getDate() - 30);

    const hotProducts = await Order.aggregate([
      { $match: { createdAt: { $gte: recentSalesThreshold }, status: 'Completed' } },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product',
          totalSold: { $sum: '$products.qty' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      { $replaceRoot: { newRoot: '$productDetails' } },
    ]);

    return {
      message: 'Hot sales products retrieved successfully',
      data: hotProducts,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching hot sales products:', error);
    return {
      message: 'Failed to fetch hot sales products',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches product recommendations using advanced aggregation.
 */
const getProductRecommendations = async (userId: string): Promise<CustomResponseType<ProductType[]>> => {
  try {
    const recommendations = await Product.aggregate([
      { $lookup: { from: 'orders', localField: '_id', foreignField: 'products.product', as: 'orderData' } },
      { $unwind: '$orderData' },
      { $match: { 'orderData.user': userId } },
      { $group: { _id: '$_id', product: { $first: '$$ROOT' }, orderCount: { $sum: 1 } } },
      { $sort: { orderCount: -1 } },
      { $limit: 10 },
      { $replaceRoot: { newRoot: '$product' } },
    ]);

    return {
      message: 'Product recommendations retrieved successfully',
      data: recommendations,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching product recommendations:', error);
    return {
      message: 'Failed to fetch product recommendations',
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
  getWeekProducts,
  getTopSoldProducts,
  getHotSalesProducts,
  getProductRecommendations,
};

export default ProductService;
