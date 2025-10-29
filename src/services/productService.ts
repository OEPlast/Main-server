import Order from '@/models/Order';
import Product, { ProductType } from '../models/Product';
import Category from '@/models/Category';
import mongoose, { PipelineStage } from 'mongoose';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import AnalyticsService from './MainAnalyticsService';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fetches all products with filters via aggregation pipeline.
 */
type ListProductsParams = {
  page?: number;
  limit?: number;
  category?: string;
  subcategory?: string;
  search?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'name' | 'createdAt' | 'rating' | 'sales';
  sortOrder?: 'asc' | 'desc';
  availability?: 'in-stock' | 'out-of-stock' | 'low-stock';
  specKey?: string;
  specValue?: string;
};

const getAllProducts = async (
  params: ListProductsParams
): Promise<
  CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }>
> => {
  try {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;

    const sortOrderNum: 1 | -1 = params.sortOrder === 'asc' ? 1 : -1;

    const match: Record<string, unknown> = {
      status: 'active',
    };
    const and: Record<string, unknown>[] = [];

    if (params.category) {
      // Allow passing category either as ID or name. Prefer ID if valid; otherwise try name.
      let categoryMatch: unknown = params.category;
      try {
        categoryMatch = new mongoose.Types.ObjectId(params.category);
        and.push({ category: categoryMatch });
      } catch {
        const cat = await Category.findOne({ name: new RegExp(`^${escapeRegex(params.category)}$`, 'i') }).select(
          '_id'
        );
        if (cat) and.push({ category: cat._id });
      }
    }
    if (params.search) {
      const rx = new RegExp(params.search, 'i');
      and.push({
        $or: [{ name: rx }],
      });
    }
    if (params.brand) {
      and.push({ brand: { $regex: params.brand, $options: 'i' } });
    }
    if (typeof params.minPrice === 'number' || typeof params.maxPrice === 'number') {
      const priceCond: Record<string, number> = {};
      if (typeof params.minPrice === 'number') priceCond.$gte = params.minPrice;
      if (typeof params.maxPrice === 'number') priceCond.$lte = params.maxPrice;
      and.push({ price: priceCond });
    }
    // Specifications filter support
    if (params.specKey && params.specValue) {
      and.push({
        specifications: {
          $elemMatch: {
            key: new RegExp(`^${escapeRegex(params.specKey)}$`, 'i'),
            value: new RegExp(escapeRegex(params.specValue), 'i'),
          },
        },
      });
    }
    if (params.availability === 'in-stock') {
      and.push({ stock: { $gt: 0 } });
    } else if (params.availability === 'out-of-stock') {
      and.push({ stock: { $eq: 0 } });
    } else if (params.availability === 'low-stock') {
      and.push({ $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] } });
    }

    if (and.length) match.$and = and;

    const pipeline: PipelineStage[] = [];
    if (Object.keys(match).length) pipeline.push({ $match: match });

    // Category populate via $lookup
    pipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    );

    // Optional sales-based sorting
    if (params.sortBy === 'sales') {
      pipeline.push(
        {
          $lookup: {
            from: 'orders',
            let: { pid: '$_id' },
            pipeline: [
              { $unwind: '$products' },
              { $match: { $expr: { $eq: ['$products.product', '$$pid'] } } },
              { $count: 'count' },
            ],
            as: 'salesAgg',
          },
        },
        { $addFields: { salesCount: { $ifNull: [{ $arrayElemAt: ['$salesAgg.count', 0] }, 0] } } },
        { $project: { salesAgg: 0 } }
      );
    }

    // Sorting
    const sortStage: Record<string, 1 | -1> = {};
    if (params.sortBy === 'sales') sortStage.salesCount = sortOrderNum;
    else if (params.sortBy === 'price') sortStage.price = sortOrderNum;
    else if (params.sortBy === 'name') sortStage.name = sortOrderNum;
    else if (params.sortBy === 'rating') sortStage.rating = sortOrderNum as 1 | -1; // rating may not exist
    else sortStage.createdAt = sortOrderNum; // default newest

    pipeline.push({ $sort: sortStage });

    // Facet for data and total count
    pipeline.push(
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                price: 1,
                sku: 1,
                tags: 1,
                slug: 1,
                attributes: 1,
                category: {
                  _id: '$category._id',
                  name: '$category.name',
                  image: '$category.image',
                  slug: '$category.slug',
                },
                description_images: 1,
              },
            },
          ],
          totalCount: [{ $count: 'total' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$totalCount.total', 0] }, 0] },
        },
      }
    );

    const agg = await Product.aggregate(pipeline).exec();
    const products = (agg[0]?.data as ProductType[]) || [];
    const total = (agg[0]?.total as number) || 0;

    return {
      message: 'Products retrieved successfully',
      data: products,
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return { message: 'Failed to fetch products', data: null, code: 500 };
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
  filters: Partial<{
    minPrice: number;
    maxPrice: number;
    category: string;
    brand: string;
    attributes: Record<string, string | number | boolean>;
    tags: string[];
    sortBy: 'price' | 'name' | 'createdAt' | 'rating' | 'sales';
    specifications: Record<string, string>;
  }>,
  page: number = 1,
  limit: number = 10
): Promise<
  CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }>
> => {
  try {
    const { minPrice, maxPrice, category, brand, attributes, tags, sortBy, specifications } = filters;

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

    if (minPrice) {
      filterConditions.$and.push({ price: { $gte: minPrice } });
    }
    if (maxPrice) {
      filterConditions.$and.push({ price: { $lte: maxPrice } });
    }

    if (category) {
      filterConditions.$and.push({ category });
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

    if (specifications && Object.keys(specifications).length) {
      for (const [key, val] of Object.entries(specifications)) {
        filterConditions.$and.push({
          specifications: {
            $elemMatch: {
              key: new RegExp(`^${escapeRegex(key)}$`, 'i'),
              value: new RegExp(escapeRegex(String(val)), 'i'),
            },
          },
        });
      }
    }

    const sort: Record<string, 1 | -1> = {};
    if (sortBy === 'price') sort.price = 1;
    if (sortBy === 'name') sort.name = -1;
    // bestseller would require order aggregation; skipping here for performance

    const products = await Product.find(filterConditions)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments(filterConditions);

    return {
      message: 'Products retrieved successfully',
      data: products as unknown as ProductType[],
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return { message: 'Failed to search products', data: null, code: 500 };
  }
};

/**
 * Fetches products of the week based on orders placed in the last 7 days.
 */
const getWeekProducts = async (
  page = 1,
  limit = 10
): CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }> => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const pipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: weekStart }, status: 'Completed' } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product', totalSold: { $sum: '$products.qty' } } },
      { $sort: { totalSold: -1 } },
      {
        $facet: {
          results: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
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
          ],
          totalCount: [{ $count: 'total' }],
        },
      },
    ];

    const agg = await Order.aggregate(pipeline).exec();
    const results = (agg[0]?.results as ProductType[]) || [];
    const total = (agg[0]?.totalCount?.[0]?.total as number) || 0;

    return {
      message: 'Week products retrieved successfully',
      data: results,
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error fetching week products:', error);
    return { message: 'Failed to fetch week products', data: null, code: 500 };
  }
};

/**
 * Fetches top sold products based on total sales from orders.
 */
const getTopSoldProducts = async (
  page = 1,
  limit = 10
): CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }> => {
  try {
    const pipeline: PipelineStage[] = [
      { $match: { status: 'Completed' } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product', totalSold: { $sum: '$products.qty' } } },
      { $sort: { totalSold: -1 } },
      {
        $facet: {
          results: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
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
          ],
          totalCount: [{ $count: 'total' }],
        },
      },
    ];

    const agg = await Order.aggregate(pipeline).exec();
    const results = (agg[0]?.results as ProductType[]) || [];
    const total = (agg[0]?.totalCount?.[0]?.total as number) || 0;

    return {
      message: 'Top sold products retrieved successfully',
      data: results,
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error fetching top sold products:', error);
    return { message: 'Failed to fetch top sold products', data: null, code: 500 };
  }
};

/**
 * Fetches hot sales products based on recent orders.
 */
const getHotSalesProducts = async (
  page = 1,
  limit = 10
): CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }> => {
  try {
    const recentSalesThreshold = new Date();
    recentSalesThreshold.setDate(recentSalesThreshold.getDate() - 30);

    const pipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: recentSalesThreshold }, status: 'Completed' } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product', totalSold: { $sum: '$products.qty' } } },
      { $sort: { totalSold: -1 } },
      {
        $facet: {
          results: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
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
          ],
          totalCount: [{ $count: 'total' }],
        },
      },
    ];

    const agg = await Order.aggregate(pipeline).exec();
    const results = (agg[0]?.results as ProductType[]) || [];
    const total = (agg[0]?.totalCount?.[0]?.total as number) || 0;

    return {
      message: 'Hot sales products retrieved successfully',
      data: results,
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error fetching hot sales products:', error);
    return { message: 'Failed to fetch hot sales products', data: null, code: 500 };
  }
};

/**
 * Fetches product recommendations using advanced aggregation.
 */
const getProductRecommendations = async (
  userId: string,
  page = 1,
  limit = 10
): CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }> => {
  try {
    let userMatch: unknown = userId;
    try {
      userMatch = new mongoose.Types.ObjectId(userId);
    } catch {
      userMatch = userId;
    }

    const pipeline: PipelineStage[] = [
      { $lookup: { from: 'orders', localField: '_id', foreignField: 'products.product', as: 'orderData' } },
      { $unwind: '$orderData' },
      { $match: { 'orderData.user': userMatch } },
      { $group: { _id: '$_id', product: { $first: '$$ROOT' }, orderCount: { $sum: 1 } } },
      { $sort: { orderCount: -1 } },
      {
        $facet: {
          results: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $replaceRoot: { newRoot: '$product' } }],
          totalCount: [{ $count: 'total' }],
        },
      },
    ];

    const agg = await Product.aggregate(pipeline).exec();
    const results = (agg[0]?.results as ProductType[]) || [];
    const total = (agg[0]?.totalCount?.[0]?.total as number) || 0;

    return {
      message: 'Product recommendations retrieved successfully',
      data: results,
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error fetching product recommendations:', error);
    return { message: 'Failed to fetch product recommendations', data: null, code: 500 };
  }
};

/**
 * Fetches product recommendations based off product id.
 */
const recommendBasedOnCurrentProduct = async (
  productId: string,
  page = 1,
  limit = 20
): CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }> => {
  try {
    const currentProduct = await Product.findById(productId);
    if (!currentProduct) {
      return { message: 'Product not found', data: null, code: 404 };
    }

    const filter = {
      _id: { $ne: productId },
      status: 'active',
      $or: [
        { category: currentProduct.category },
        { name: { $regex: currentProduct.name.split(' ').join('|'), $options: 'i' } },
      ],
    } as Record<string, unknown>;

    const [results, total] = await Promise.all([
      Product.find(filter)
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return {
      message: 'Product recommendations retrieved successfully',
      data: results as unknown as ProductType[],
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error fetching product recommendations:', error);
    return { message: 'Failed to fetch product recommendations', data: null, code: 500 };
  }
};
// New: products by category slug (includes descendants)
async function getByCategorySlug(
  slug: string,
  page = 1,
  limit = 20,
  sort: 'newest' | 'price_asc' | 'price_desc' | 'popular' = 'newest'
): CustomResponseTypeWithMeta<
  ProductType[],
  { total: number; page: number; limit: number; pages: number; slug: string }
> {
  try {
    const base = await Category.findOne({ slug });
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
    return {
      message: 'Products retrieved successfully',
      data,
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit), slug },
    };
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

/**
 * Fetches top categories based on product purchase volume.
 * Returns at most 10 categories sorted by total products sold.
 */
const getTopCategories = async (
  limit = 10
): Promise<
  CustomResponseType<
    Array<{
      _id: string;
      name: string;
      slug: string;
      image: string;
    }>
  >
> => {
  try {
    const maxLimit = Math.min(limit, 10); // Cap at 10

    const pipeline: PipelineStage[] = [
      // Match completed orders only
      { $match: { status: 'Completed' } },
      // Unwind products array to get individual products
      { $unwind: '$products' },
      // Lookup product details
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: false } },
      // Lookup category details
      {
        $lookup: {
          from: 'categories',
          localField: 'productDetails.category',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: false } },
      // Group by category
      {
        $group: {
          _id: '$categoryDetails._id',
          name: { $first: '$categoryDetails.name' },
          slug: { $first: '$categoryDetails.slug' },
          image: { $first: '$categoryDetails.image' },
          totalSold: { $sum: '$products.qty' },
          productCount: { $addToSet: '$products.product' },
        },
      },
      // Count unique products per category
      { $addFields: { productCount: { $size: '$productCount' } } },
      // Sort by total sold descending
      { $sort: { totalSold: -1 } },
      // Limit to top N categories
      { $limit: maxLimit },
      // Format output
      {
        $project: {
          _id: { $toString: '$_id' },
          name: 1,
          slug: 1,
          image: 1,
        },
      },
    ];

    const results = await Order.aggregate(pipeline).exec();

    return {
      message: 'Top categories retrieved successfully',
      data: results as Array<{
        _id: string;
        name: string;
        slug: string;
        image: string;
      }>,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching top categories:', error);
    return { message: 'Failed to fetch top categories', data: null, code: 500 };
  }
};

const ProductService = {
  getAllProducts,
  getProductById,
  getProductBySlug,
  getProductStock,
  searchProducts,
  getByCategorySlug,
  getWeekProducts,
  getTopSoldProducts,
  getHotSalesProducts,
  getProductRecommendations,
  recommendBasedOnCurrentProduct,
  getTopCategories,
};

export default ProductService;
