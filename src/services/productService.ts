import Order from '@/models/Order';
import Product, { ProductType } from '../models/Product';
import Category from '@/models/Category';
import mongoose, { PipelineStage } from 'mongoose';
import { CustomResponsePromise, CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import AnalyticsService from './MainAnalyticsService';

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
    subCategory?: string;
    brand?: string;
    attributes?: Record<string, string | number | boolean>;
    tags?: string[];
    sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'bestseller';
  },
  page: number = 1,
  limit: number = 10
): Promise<CustomResponseType<{ products: ProductType[]; meta: { total: number; page: number; limit: number } }>> => {
  try {
    const { priceRange, category, subCategory, brand, attributes, tags, sortBy } = filters;

    type AndFilter = Array<Record<string, unknown>>;
    const filterConditions: { $and: AndFilter } = {
      $and: [
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { brand: { $regex: query, $options: 'i' } },
            { tags: { $elemMatch: { $regex: query, $options: 'i' } } },
          ],
        },
      ],
    };

    if (priceRange) {
      filterConditions.$and.push({ price: { $gte: priceRange.min, $lte: priceRange.max } });
    }

    if (category) {
      filterConditions.$and.push({ category });
    }

    if (subCategory) {
      filterConditions.$and.push({ subCategories: subCategory });
    }

    if (brand) {
      filterConditions.$and.push({ brand: { $regex: brand, $options: 'i' } });
    }

    if (attributes && Object.keys(attributes).length) {
      filterConditions.$and.push({ attributes: { $elemMatch: attributes } });
    }

    if (tags && tags.length) {
      filterConditions.$and.push({ tags: { $in: tags } });
    }

    const sort: Record<string, 1 | -1> = {};
    if (sortBy === 'price_asc') sort.price = 1;
    if (sortBy === 'price_desc') sort.price = -1;
    if (sortBy === 'newest') sort.createdAt = -1;
    // bestseller would require order aggregation; skipping here for performance

    const products = await Product.find(filterConditions)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments(filterConditions);

    return {
      message: 'Products retrieved successfully',
      data: { products, meta: { total, page, limit } },
      code: 200,
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return { message: 'Failed to search products', data: null, code: 500 };
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

/**
 * Fetches product recommendations based off product id.
 */
const recommendBasedOnCurrentProduct = async (productId: string): CustomResponsePromise<ProductType[]> => {
  try {
    const currentProduct = await Product.findById(productId);
    if (!currentProduct) {
      return { message: 'Product not found', data: [], code: 404 };
    }

    const recommendation = await Product.find({
      _id: { $ne: productId },
      status: 'active',
      $or: [
        { category: currentProduct.category },
        { name: { $regex: currentProduct.name.split(' ').join('|'), $options: 'i' } },
      ],
    }).limit(20);
    return {
      message: 'Product recommendations retrieved successfully',
      data: recommendation,
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
  getProductBySlug,
  getProductStock,
  searchProducts,
  getProductsByCategoryAndSubCategory,
  getByCategorySlug,
  getWeekProducts,
  getTopSoldProducts,
  getHotSalesProducts,
  getProductRecommendations,
  recommendBasedOnCurrentProduct,
};

export default ProductService;

// New: products by category slug (includes descendants)
async function getByCategorySlug(
  slug: string,
  page = 1,
  limit = 20,
  sort: 'newest' | 'price_asc' | 'price_desc' | 'popular' = 'newest'
): CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; slug: string }> {
  try {
    const base = await Category.findOne({ slug }).lean().exec();
    if (!base) return { message: 'Category not found', data: null, code: 404 };

    const sortStage: Record<string, 1 | -1> = {};
    if (sort === 'newest') sortStage.createdAt = -1;
    if (sort === 'price_asc') sortStage.price = 1;
    if (sort === 'price_desc') sortStage.price = -1;

    const pipeline: PipelineStage[] = [
      // match all categories where base._id is in parent list or itself
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'cat',
        },
      },
      { $unwind: '$cat' },
      {
        $match: {
          $or: [
            { 'cat._id': base._id },
            { 'cat.parent': { $elemMatch: { $eq: new mongoose.Types.ObjectId(base._id) } } },
          ],
          status: 'active',
        },
      },
    ];

    if (sort === 'popular') {
      pipeline.push(
        {
          $lookup: {
            from: 'orders',
            localField: '_id',
            foreignField: 'products.product',
            as: 'ord',
          },
        },
        { $addFields: { salesCount: { $size: '$ord' } } },
        { $sort: { salesCount: -1, createdAt: -1 } },
        { $project: { ord: 0 } }
      );
    } else if (Object.keys(sortStage).length) {
      pipeline.push({ $sort: sortStage });
    }

    pipeline.push(
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      }
    );

    const agg = await Product.aggregate(pipeline).exec();
    const data = (agg[0]?.data as ProductType[]) || [];
    const total = (agg[0]?.total as number) || 0;
    return { message: 'Products retrieved successfully', data, code: 200, meta: { total, page, limit, slug } };
  } catch (e) {
    console.error('getByCategorySlug error:', e);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
}

// New: get single product by slug
async function getProductBySlug(slug: string): Promise<CustomResponseType<ProductType>> {
  try {
    const product = await Product.findOne({ slug });
    if (!product) {
      return { message: 'Product not found', data: null, code: 404 };
    }

    // Track product view for analytics (non-blocking)
    AnalyticsService.trackProductView(String(product._id)).catch((err) =>
      console.error('Failed to track product view analytics:', err)
    );

    return { message: 'Product retrieved successfully', data: product, code: 200 };
  } catch (error) {
    console.error('Error fetching product by slug:', error);
    return { message: 'Failed to fetch product', data: null, code: 500 };
  }
}
