import Order from '@/models/Order';
import Product, { ProductType } from '../models/Product';
import Sales, { SalesType } from '../models/Sales';
import Category from '@/models/Category';
import mongoose, { PipelineStage } from 'mongoose';
import { buildPriceFilter, buildTagsFilter } from './aggregation';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import AnalyticsService from './MainAnalyticsService';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Adds sale lookup stages to aggregation pipeline.
 * Populates active sales for products (one sale per product).
 */
function addSaleLookupStages(): any[] {
  return [
    {
      $lookup: {
        from: 'sales',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$product', '$$productId'] },
              isActive: true,
              deleted: false,
            },
          },
          { $limit: 1 }, // Only one sale per product
        ],
        as: 'saleData',
      },
    },
    {
      $addFields: {
        sale: { $arrayElemAt: ['$saleData', 0] },
        packSizes: 1,
      },
    },
    {
      $project: {
        saleData: 0, // Remove temporary field
      },
    },
  ];
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
    pipeline.push({
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          ...addSaleLookupStages(), // Add sale population
          {
            $project: {
              _id: 1,
              name: 1,
              price: 1,
              createdAt: 1,
              sku: 1,
              tags: 1,
              slug: 1,
              stock: 1,
              originStock: 1,
              packSizes: 1,
              attributes: 1,
              category: {
                _id: '$category._id',
                name: '$category.name',
                image: '$category.image',
                slug: '$category.slug',
              },
              description_images: 1,
              sale: 1, // Include sale field
            },
          },
        ],
        totalCount: [{ $count: 'total' }],
      },
    });

    pipeline.push({
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$totalCount.total', 0] }, 0] },
      },
    });

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
const getProductById = async (
  productId: string
): Promise<CustomResponseType<ProductType & { sale?: SalesType | null }>> => {
  try {
    const pipeline: PipelineStage[] = [
      { $match: { _id: new mongoose.Types.ObjectId(productId) } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      ...addSaleLookupStages(),
    ];

    const products = await Product.aggregate(pipeline).exec();
    const product = products[0];

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

    // Use aggregation for consistent sale population
    const pipeline: PipelineStage[] = [
      { $match: filterConditions },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      ...addSaleLookupStages(),
    ];

    if (Object.keys(sort).length) {
      pipeline.push({ $sort: sort });
    }

    pipeline.push({
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        totalCount: [{ $count: 'total' }],
      },
    });

    pipeline.push({
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$totalCount.total', 0] }, 0] },
      },
    });

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
    console.error('Error searching products:', error);
    return { message: 'Failed to search products', data: null, code: 500 };
  }
};

/**
 * Fetches products of the week based on orders placed in the last 7 days.
 * Now supports filtering like campaigns for dedicated pages.
 */
const getWeekProducts = async (
  page = 1,
  limit = 20,
  sortOptions: Array<
    'alphabetical' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'stock' | 'order_frequency' | 'rating'
  > = ['order_frequency'], // Default: most sold first
  filters?: ProductFilters
): CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }> => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    // First, get all product IDs sold in the last 7 days
    const soldProductsPipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: weekStart }, status: 'Completed' } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product', totalSold: { $sum: '$products.qty' } } },
      { $project: { productId: '$_id', orderFrequency: '$totalSold' } },
    ];

    const soldProducts = await Order.aggregate(soldProductsPipeline).exec();
    const productIds = soldProducts.map((p) => p.productId);

    if (productIds.length === 0) {
      return {
        message: 'No week products found',
        data: [],
        code: 200,
        meta: { total: 0, page, limit, pages: 0 },
      };
    }

    // Build product aggregation pipeline with filters
    const pipeline: PipelineStage[] = [{ $match: { _id: { $in: productIds }, status: 'active' } }];

    // Apply filters
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      const priceMatch: { $gte?: number; $lte?: number } = {};
      if (filters.minPrice !== undefined) priceMatch.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) priceMatch.$lte = filters.maxPrice;
      pipeline.push({ $match: { price: priceMatch } });
    }

    if (filters?.inStock) {
      pipeline.push({ $match: { stock: { $gt: 0 } } });
    }

    if (filters?.packSize) {
      pipeline.push({ $match: { 'packSizes.label': filters.packSize } });
    }

    if (filters?.tags && filters.tags.length > 0) {
      pipeline.push({ $match: { tags: { $in: filters.tags } } });
    }

    if (filters?.attributes && Object.keys(filters.attributes).length > 0) {
      const andExpr: unknown[] = Object.entries(filters.attributes).map(([attrName, values]) => ({
        $anyElementTrue: {
          $map: {
            input: '$attributes',
            as: 'attr',
            in: {
              $and: [
                { $eq: ['$$attr.name', attrName] },
                {
                  $anyElementTrue: {
                    $map: {
                      input: '$$attr.children',
                      as: 'child',
                      in: { $in: ['$$child.name', values] },
                    },
                  },
                },
              ],
            },
          },
        },
      }));
      pipeline.push({ $match: { $expr: { $and: andExpr } } });
    }

    // Add order frequency from soldProducts
    pipeline.push({
      $addFields: {
        orderFrequency: {
          $let: {
            vars: {
              match: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: soldProducts,
                      as: 'sold',
                      cond: { $eq: ['$$sold.productId', '$_id'] },
                    },
                  },
                  0,
                ],
              },
            },
            in: { $ifNull: ['$$match.orderFrequency', 0] },
          },
        },
      },
    });

    // Lookup category
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

    // Build multi-sort
    const sortStage: Record<string, 1 | -1> = {};
    for (const sortOption of sortOptions) {
      switch (sortOption) {
        case 'alphabetical':
          sortStage.name = 1;
          break;
        case 'newest':
          sortStage.createdAt = -1;
          break;
        case 'price_asc':
          sortStage.price = 1;
          break;
        case 'price_desc':
          sortStage.price = -1;
          break;
        case 'popular':
          sortStage.popularityScore = -1;
          break;
        case 'stock':
          sortStage.stock = -1;
          break;
        case 'order_frequency':
          sortStage.orderFrequency = -1;
          break;
        case 'rating':
          sortStage.rating = -1;
          break;
      }
    }
    if (Object.keys(sortStage).length) {
      pipeline.push({ $sort: sortStage });
    }

    // Pagination
    pipeline.push({
      $facet: {
        results: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              price: 1,
              createdAt: 1,
              sku: 1,
              stock: 1,
              originStock: 1,
              rating: 1,
              images: '$description_images',
              category: 1,
              packSizes: 1,
              attributes: 1,
            },
          },
        ],
        totalCount: [{ $count: 'total' }],
      },
    });

    const agg = await Product.aggregate(pipeline).exec();
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
 * Now supports filtering like campaigns for dedicated pages.
 */
const getTopSoldProducts = async (
  page = 1,
  limit = 10,
  sortOptions: Array<
    'alphabetical' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'stock' | 'order_frequency' | 'rating'
  > = ['order_frequency'], // Default: most sold first
  filters?: ProductFilters
): CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }> => {
  try {
    // First, get all product IDs from completed orders
    const soldProductsPipeline: PipelineStage[] = [
      { $match: { status: 'Completed' } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product', totalSold: { $sum: '$products.qty' } } },
      { $project: { productId: '$_id', orderFrequency: '$totalSold' } },
    ];

    const soldProducts = await Order.aggregate(soldProductsPipeline).exec();
    const productIds = soldProducts.map((p) => p.productId);

    if (productIds.length === 0) {
      return {
        message: 'No top sold products found',
        data: [],
        code: 200,
        meta: { total: 0, page, limit, pages: 0 },
      };
    }

    // Build product aggregation pipeline with filters
    const pipeline: PipelineStage[] = [{ $match: { _id: { $in: productIds }, status: 'active' } }];

    // Apply filters
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      const priceMatch: { $gte?: number; $lte?: number } = {};
      if (filters.minPrice !== undefined) priceMatch.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) priceMatch.$lte = filters.maxPrice;
      pipeline.push({ $match: { price: priceMatch } });
    }

    if (filters?.inStock) {
      pipeline.push({ $match: { stock: { $gt: 0 } } });
    }

    if (filters?.packSize) {
      pipeline.push({ $match: { 'packSizes.label': filters.packSize } });
    }

    if (filters?.tags && filters.tags.length > 0) {
      pipeline.push({ $match: { tags: { $in: filters.tags } } });
    }

    if (filters?.attributes && Object.keys(filters.attributes).length > 0) {
      const andExpr: unknown[] = Object.entries(filters.attributes).map(([attrName, values]) => ({
        $anyElementTrue: {
          $map: {
            input: '$attributes',
            as: 'attr',
            in: {
              $and: [
                { $eq: ['$$attr.name', attrName] },
                {
                  $anyElementTrue: {
                    $map: {
                      input: '$$attr.children',
                      as: 'child',
                      in: { $in: ['$$child.name', values] },
                    },
                  },
                },
              ],
            },
          },
        },
      }));
      pipeline.push({ $match: { $expr: { $and: andExpr } } });
    }

    // Add order frequency from soldProducts
    pipeline.push({
      $addFields: {
        orderFrequency: {
          $let: {
            vars: {
              match: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: soldProducts,
                      as: 'sold',
                      cond: { $eq: ['$$sold.productId', '$_id'] },
                    },
                  },
                  0,
                ],
              },
            },
            in: { $ifNull: ['$$match.orderFrequency', 0] },
          },
        },
      },
    });

    // Lookup category
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

    // Build multi-sort
    const sortStage: Record<string, 1 | -1> = {};
    for (const sortOption of sortOptions) {
      switch (sortOption) {
        case 'alphabetical':
          sortStage.name = 1;
          break;
        case 'newest':
          sortStage.createdAt = -1;
          break;
        case 'price_asc':
          sortStage.price = 1;
          break;
        case 'price_desc':
          sortStage.price = -1;
          break;
        case 'popular':
          sortStage.popularityScore = -1;
          break;
        case 'stock':
          sortStage.stock = -1;
          break;
        case 'order_frequency':
          sortStage.orderFrequency = -1;
          break;
        case 'rating':
          sortStage.rating = -1;
          break;
      }
    }
    if (Object.keys(sortStage).length) {
      pipeline.push({ $sort: sortStage });
    }

    // Pagination
    pipeline.push({
      $facet: {
        results: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              price: 1,
              createdAt: 1,
              sku: 1,
              stock: 1,
              originStock: 1,
              rating: 1,
              images: '$description_images',
              category: 1,
              packSizes: 1,
              attributes: 1,
            },
          },
        ],
        totalCount: [{ $count: 'total' }],
      },
    });

    const agg = await Product.aggregate(pipeline).exec();
    const results = (agg[0]?.results as ProductType[]) || [];
    const total = (agg[0]?.totalCount?.[0]?.total as number) || 0;

    return {
      message: 'Top sold products retrieved successfully',
      data: results,
      code: 200,
      meta: { total, page, limit, pages: Math.min(Math.ceil(total / limit), 9) },
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
            {
              $project: {
                _id: 1,
                name: 1,
                slug: 1,
                price: 1,
                createdAt: 1,
                sku: 1,
                stock: 1,
                originStock: 1,
                rating: 1,
                images: '$description_images', // Rename description_images to images
                category: 1,
                packSizes: 1,
                attributes: 1,
              },
            },
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
/**
 * Get all products by category slug with subcategory support and multi-level sorting.
 *
 * **Subcategory Handling**:
 * - If category has subcategories, gets products from all subcategories
 * - If category has no subcategories, gets products from that category only
 *
 * **Multi-Sort Support**:
 * - Accepts an array of sort options to apply in priority order
 * - Default: ['alphabetical', 'newest'] - sorts A-Z first, then by newest
 * - Example: ['price_asc', 'popular', 'alphabetical'] - price first, then popularity, then name
 *
 * **Sort Options**:
 * - alphabetical: A-Z by product name
 * - newest: Recently added products first
 * - price_asc: Lowest to highest price
 * - price_desc: Highest to lowest price
 * - popular: Trending products (30-day order volume)
 * - order_frequency: Most ordered products (completed orders)
 * - stock: By inventory quantity (may be commented)
 * - rating: By review ratings (may be commented, requires Review model)
 *
 * @param slug - Category slug
 * @param page - Page number for pagination (default: 1)
 * @param limit - Number of items per page (default: 20)
 * @param sortOptions - Array of sort options in priority order (default: ['alphabetical', 'newest'])
 *
 * @example
 * // Default: alphabetical then newest
 * getByCategorySlug('electronics', 1, 20, ['alphabetical', 'newest'])
 *
 * @example
 * // Price ascending, then most ordered, then name
 * getByCategorySlug('fashion', 1, 20, ['price_asc', 'order_frequency', 'alphabetical'])
 */
type CategoryFilters = {
  minPrice?: number;
  maxPrice?: number;
  subcategory?: string; // slug of direct child to restrict to
  tags?: string[];
  packSize?: string;
  inStock?: boolean;
  attributes?: Record<string, string[]>; // AttributeName -> values
  specs?: Record<string, string[]>; // SpecKey -> values
};

async function getByCategorySlug(
  slug: string,
  page = 1,
  limit = 20,
  sortOptions: Array<
    'alphabetical' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'stock' | 'order_frequency' | 'rating'
  > = ['alphabetical', 'newest'],
  filters?: CategoryFilters,
  includeStats?: boolean
): CustomResponseTypeWithMeta<
  ProductType[],
  { total: number; page: number; limit: number; pages: number; slug: string; hasSubcategories: boolean }
> {
  try {
    // Find the base category
    const baseCategory = await Category.findOne({ slug });
    if (!baseCategory) {
      return { message: 'Category not found', data: null, code: 404 };
    }

    // Find all subcategories where this category is in their parent array
    const subcategories = await Category.find({
      parent: { $elemMatch: { $eq: baseCategory._id } },
    }).select('_id');

    const hasSubcategories = subcategories.length > 0;

    // Build category match condition (respect subcategory filter if provided)
    let categoryIds: mongoose.Types.ObjectId[];
    if (filters?.subcategory) {
      const sub = await Category.findOne({ slug: filters.subcategory }).select('_id');
      categoryIds = sub ? [sub._id] : [baseCategory._id];
    } else if (hasSubcategories) {
      categoryIds = [baseCategory._id, ...subcategories.map((sub) => sub._id)];
    } else {
      categoryIds = [baseCategory._id];
    }

    const pipeline: PipelineStage[] = [
      // Step 1: Match products in the category or its subcategories
      { $match: { category: { $in: categoryIds }, status: 'active' } },

      // Step 2: Lookup category details
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    ];

    // Step 3: Apply filters
    if (filters?.minPrice != null || filters?.maxPrice != null) {
      const priceStage = buildPriceFilter(filters?.minPrice, filters?.maxPrice);
      if (priceStage) pipeline.push(priceStage);
    }

    if (filters?.inStock) {
      pipeline.push({ $match: { stock: { $gt: 0 } } });
    }

    if (filters?.tags && filters.tags.length) {
      const tagStage = buildTagsFilter(filters.tags);
      if (tagStage) pipeline.push(tagStage);
    }

    if (filters?.packSize) {
      pipeline.push({ $match: { 'packSizes.label': filters.packSize } });
    }

    if (filters?.specs && Object.keys(filters.specs).length) {
      const andSpecs: Array<Record<string, unknown>> = [];
      for (const [key, values] of Object.entries(filters.specs)) {
        andSpecs.push({
          specifications: {
            $elemMatch: {
              key: new RegExp(`^${escapeRegex(key)}$`, 'i'),
              value: { $in: values },
            },
          },
        });
      }
      if (andSpecs.length) pipeline.push({ $match: { $and: andSpecs } });
    }

    if (filters?.attributes && Object.keys(filters.attributes).length) {
      // Inline attribute OR/AND logic: attribute name AND across attributes, OR within values
      const andExpr: unknown[] = Object.entries(filters.attributes).map(([attrName, values]) => ({
        $anyElementTrue: {
          $map: {
            input: '$attributes',
            as: 'attr',
            in: {
              $and: [
                { $eq: ['$$attr.name', attrName] },
                {
                  $anyElementTrue: {
                    $map: {
                      input: '$$attr.children',
                      as: 'child',
                      in: { $in: ['$$child.name', values] },
                    },
                  },
                },
              ],
            },
          },
        },
      }));
      pipeline.push({ $match: { $expr: { $and: andExpr } } });
    }

    // Step 4: Build multi-level sorting based on sortOptions array
    // Process each sort option in the array to determine which aggregation stages are needed
    const needsOrderFrequency = sortOptions.includes('order_frequency');
    const needsPopular = sortOptions.includes('popular');
    const needsRating = sortOptions.includes('rating');

    // Add aggregation stages for advanced sorting options
    if (needsOrderFrequency) {
      // Add order frequency calculation
      pipeline.push(
        {
          $lookup: {
            from: 'orders',
            let: { productId: '$_id' },
            pipeline: [
              { $match: { status: 'Completed' } },
              { $unwind: '$products' },
              {
                $match: {
                  $expr: { $eq: ['$products.product', '$$productId'] },
                },
              },
              {
                $group: {
                  _id: null,
                  orderCount: { $sum: 1 },
                  totalQuantity: { $sum: '$products.qty' },
                },
              },
            ],
            as: 'orderStats',
          },
        },
        {
          $addFields: {
            orderFrequency: {
              $ifNull: [{ $arrayElemAt: ['$orderStats.orderCount', 0] }, 0],
            },
            totalSold: {
              $ifNull: [{ $arrayElemAt: ['$orderStats.totalQuantity', 0] }, 0],
            },
          },
        }
      );
    }

    if (needsPopular) {
      // Add popularity calculation (30-day order volume)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      pipeline.push(
        {
          $lookup: {
            from: 'orders',
            let: { productId: '$_id' },
            pipeline: [
              {
                $match: {
                  status: 'Completed',
                  createdAt: { $gte: thirtyDaysAgo },
                },
              },
              { $unwind: '$products' },
              {
                $match: {
                  $expr: { $eq: ['$products.product', '$$productId'] },
                },
              },
              {
                $group: {
                  _id: null,
                  recentOrders: { $sum: 1 },
                  recentQuantity: { $sum: '$products.qty' },
                },
              },
            ],
            as: 'popularityStats',
          },
        },
        {
          $addFields: {
            popularityScore: {
              $ifNull: [{ $arrayElemAt: ['$popularityStats.recentOrders', 0] }, 0],
            },
          },
        }
      );
    }

    // OPTION: Rating sorting (commented - requires Review model)
    // Uncomment when Review model is implemented
    // if (needsRating) {
    //   pipeline.push(
    //     {
    //       $lookup: {
    //         from: 'reviews',
    //         localField: '_id',
    //         foreignField: 'product',
    //         as: 'reviews',
    //       },
    //     },
    //     {
    //       $addFields: {
    //         averageRating: {
    //           $cond: {
    //             if: { $gt: [{ $size: '$reviews' }, 0] },
    //             then: { $avg: '$reviews.rating' },
    //             else: 0,
    //           },
    //         },
    //         reviewCount: { $size: '$reviews' },
    //       },
    //     }
    //   );
    // }

    // Build the combined sort stage from sortOptions array
    const sortStage: Record<string, 1 | -1> = {};

    for (const sortOption of sortOptions) {
      switch (sortOption) {
        case 'alphabetical':
          sortStage.name = 1; // A-Z
          break;
        case 'newest':
          sortStage.createdAt = -1; // Recent first
          break;
        case 'price_asc':
          sortStage.price = 1; // Low to high
          break;
        case 'price_desc':
          sortStage.price = -1; // High to low
          break;
        case 'order_frequency':
          sortStage.orderFrequency = -1; // Most ordered first
          sortStage.totalSold = -1; // Then by total quantity sold
          break;
        case 'popular':
          sortStage.popularityScore = -1; // Most popular first (30-day)
          break;
        case 'stock':
          // OPTION: Uncomment when ready to use stock sorting
          // sortStage.stock = -1; // Highest stock first
          break;
        case 'rating':
          // OPTION: Uncomment when Review model is implemented
          // sortStage.averageRating = -1; // Highest rating first
          // sortStage.reviewCount = -1; // Then by review count
          break;
      }
    }

    // Apply the combined sort stage
    if (Object.keys(sortStage).length) {
      pipeline.push({ $sort: sortStage });
    }

    // Clean up temporary fields
    const cleanupFields: Record<string, 0> = {};
    if (needsOrderFrequency) {
      cleanupFields.orderStats = 0;
    }
    if (needsPopular) {
      cleanupFields.popularityStats = 0;
    }
    if (Object.keys(cleanupFields).length) {
      pipeline.push({ $project: cleanupFields });
    }

    // Optionally include computed stats for UI when requested via includeStats
    // We only add lookups here if they were NOT already added above by sorting needs
    if (includeStats) {
      if (!needsOrderFrequency) {
        pipeline.push(
          {
            $lookup: {
              from: 'orders',
              let: { productId: '$_id' },
              pipeline: [
                { $match: { status: 'Completed' } },
                { $unwind: '$products' },
                { $match: { $expr: { $eq: ['$products.product', '$$productId'] } } },
                { $group: { _id: null, orderCount: { $sum: 1 }, totalQuantity: { $sum: '$products.qty' } } },
              ],
              as: 'orderStats',
            },
          },
          {
            $addFields: {
              orderFrequency: { $ifNull: [{ $arrayElemAt: ['$orderStats.orderCount', 0] }, 0] },
              totalSold: { $ifNull: [{ $arrayElemAt: ['$orderStats.totalQuantity', 0] }, 0] },
            },
          }
        );
      }
      if (!needsPopular) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        pipeline.push(
          {
            $lookup: {
              from: 'orders',
              let: { productId: '$_id' },
              pipeline: [
                { $match: { status: 'Completed', createdAt: { $gte: thirtyDaysAgo } } },
                { $unwind: '$products' },
                { $match: { $expr: { $eq: ['$products.product', '$$productId'] } } },
                { $group: { _id: null, recentOrders: { $sum: 1 } } },
              ],
              as: 'popularityStats',
            },
          },
          { $addFields: { popularityScore: { $ifNull: [{ $arrayElemAt: ['$popularityStats.recentOrders', 0] }, 0] } } }
        );
      }
      // Ensure we don't leak intermediate arrays when includeStats is used
      const cleanupStats: Record<string, 0> = {};
      if (!needsOrderFrequency) cleanupStats.orderStats = 0;
      if (!needsPopular) cleanupStats.popularityStats = 0;
      if (Object.keys(cleanupStats).length) {
        pipeline.push({ $project: cleanupStats });
      }
    }

    // Step 5: Pagination with facet
    pipeline.push({
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          ...addSaleLookupStages(), // Add sale information
        ],
        total: [{ $count: 'count' }],
      },
    });

    // Step 6: Project final structure
    pipeline.push({
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
      },
    });

    // Execute aggregation
    const agg = await Product.aggregate(pipeline).exec();
    const data = (agg[0]?.data as ProductType[]) || [];
    const total = (agg[0]?.total as number) || 0;

    return {
      message: hasSubcategories
        ? `Products retrieved from ${baseCategory.name} and its subcategories`
        : `Products retrieved from ${baseCategory.name}`,
      data: data,
      code: 200,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        slug,
        hasSubcategories,
      },
    };
  } catch (e) {
    console.error('getByCategorySlug error:', e);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
}

// New: get single product by slug
async function getProductBySlug(slug: string): Promise<CustomResponseType<ProductType & { sale?: SalesType | null }>> {
  try {
    const pipeline: PipelineStage[] = [
      { $match: { slug } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      ...addSaleLookupStages(),
    ];

    const products = await Product.aggregate(pipeline).exec();
    const product = products[0];

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
 * Returns exactly 10 categories - top sellers first, then fills with other categories.
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

    // If we have fewer than the requested limit, fill with other categories
    if (results.length < maxLimit) {
      const topCategoryIds = results.map((cat) => new mongoose.Types.ObjectId(cat._id));
      const remaining = maxLimit - results.length;

      // Fetch additional categories that aren't in the top results
      const additionalCategories = await Category.find({
        _id: { $nin: topCategoryIds },
      })
        .select('_id name slug image')
        .limit(remaining)
        .lean();

      // Format additional categories to match the output format
      const formattedAdditional = additionalCategories.map((cat) => ({
        _id: String(cat._id),
        name: cat.name,
        slug: cat.slug,
        image: cat.image || '',
      }));

      // Combine top categories with additional ones
      results.push(...formattedAdditional);
    }

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

/**
 * Product filters type (same as campaign filters)
 */
type ProductFilters = {
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  attributes?: Record<string, string[]>;
  inStock?: boolean;
  packSize?: string;
};

/**
 * Fetches newly added products (sorted by createdAt descending).
 * Returns products with variants and sale information.
 * Now supports filtering like campaigns for dedicated pages.
 */
const getNewProducts = async (
  page = 1,
  limit = 20,
  sortOptions: Array<
    'alphabetical' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'stock' | 'order_frequency' | 'rating'
  > = ['newest'], // Default: newest first
  filters?: ProductFilters
): Promise<
  CustomResponseTypeWithMeta<
    (ProductType & { sale?: SalesType | null })[],
    { total: number; page: number; limit: number; pages: number }
  >
> => {
  try {
    const pipeline: PipelineStage[] = [{ $match: { status: 'active' } }];

    // Apply filters (before sorting/pagination for efficiency)
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      const priceMatch: { $gte?: number; $lte?: number } = {};
      if (filters.minPrice !== undefined) priceMatch.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) priceMatch.$lte = filters.maxPrice;
      pipeline.push({ $match: { price: priceMatch } });
    }

    if (filters?.inStock) {
      pipeline.push({ $match: { stock: { $gt: 0 } } });
    }

    if (filters?.packSize) {
      pipeline.push({ $match: { 'packSizes.label': filters.packSize } });
    }

    if (filters?.tags && filters.tags.length > 0) {
      pipeline.push({ $match: { tags: { $in: filters.tags } } });
    }

    if (filters?.attributes && Object.keys(filters.attributes).length > 0) {
      const andExpr: unknown[] = Object.entries(filters.attributes).map(([attrName, values]) => ({
        $anyElementTrue: {
          $map: {
            input: '$attributes',
            as: 'attr',
            in: {
              $and: [
                { $eq: ['$$attr.name', attrName] },
                {
                  $anyElementTrue: {
                    $map: {
                      input: '$$attr.children',
                      as: 'child',
                      in: { $in: ['$$child.name', values] },
                    },
                  },
                },
              ],
            },
          },
        },
      }));
      pipeline.push({ $match: { $expr: { $and: andExpr } } });
    }

    // Lookup category
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

    // Build multi-sort
    const sortStage: Record<string, 1 | -1> = {};
    for (const sortOption of sortOptions) {
      switch (sortOption) {
        case 'alphabetical':
          sortStage.name = 1;
          break;
        case 'newest':
          sortStage.createdAt = -1;
          break;
        case 'price_asc':
          sortStage.price = 1;
          break;
        case 'price_desc':
          sortStage.price = -1;
          break;
        case 'popular':
          sortStage.popularityScore = -1;
          break;
        case 'stock':
          sortStage.stock = -1;
          break;
        case 'order_frequency':
          sortStage.orderFrequency = -1;
          break;
        case 'rating':
          sortStage.rating = -1;
          break;
      }
    }
    if (Object.keys(sortStage).length) {
      pipeline.push({ $sort: sortStage });
    }

    // Pagination and projection
    pipeline.push({
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          ...addSaleLookupStages(), // Add sale population
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              price: 1,
              createdAt: 1,
              sku: 1,
              stock: 1,
              originStock: 1,
              rating: 1,
              images: '$description_images', // Rename description_images to images
              category: 1,
              attributes: 1,
              packSizes: 1,
              sale: 1,
            },
          },
        ],
        totalCount: [{ $count: 'total' }],
      },
    });

    pipeline.push({
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$totalCount.total', 0] }, 0] },
      },
    });

    const agg = await Product.aggregate(pipeline).exec();
    const products = (agg[0]?.data as ProductType[]) || [];
    const total = (agg[0]?.total as number) || 0;

    return {
      message: 'New products retrieved successfully',
      data: products,
      code: 200,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Error fetching new products:', error);
    return {
      message: 'Failed to fetch new products',
      data: null,
      code: 500,
    };
  }
};

/**
 * Search autocomplete - returns quick product suggestions based on query.
 * Returns minimal product info for fast autocomplete responses.
 */
const searchAutocomplete = async (
  query: string,
  limit = 10
): Promise<
  CustomResponseType<
    Array<{
      _id: string;
      name: string;
      slug: string;
      price: number;
      image?: string;
      category?: { name: string; slug: string };
    }>
  >
> => {
  try {
    const q = (query || '').trim();
    if (q.length < 2) {
      return { message: 'Query too short', data: [], code: 200 };
    }

    // Prefer MongoDB Atlas Search if available
    const searchIndex = process.env.ATLAS_SEARCH_INDEX || 'default';

    let results: Array<{
      _id: string;
      name: string;
      slug: string;
      price: number;
      image?: string;
      category?: { name: string; slug: string };
    }> = [];

    try {
      const pipeline: PipelineStage[] = [
        {
          $search: {
            index: searchIndex,
            compound: {
              should: [
                {
                  autocomplete: {
                    path: 'name',
                    query: q,
                    tokenOrder: 'sequential',
                  },
                },
                {
                  text: {
                    query: q,
                    path: ['name', 'tags'],
                    fuzzy: { maxEdits: 1 },
                  },
                },
              ],
              minimumShouldMatch: 1,
            },
          },
        } as unknown as PipelineStage, // $search is an Atlas stage not in TS types
        { $match: { status: 'active' } },
        {
          $project: {
            name: 1,
            slug: 1,
            price: 1,
            description_images: 1,
            category: 1,
            _score: { $meta: 'searchScore' },
          },
        },
        { $sort: { _score: -1 } },
        { $limit: Math.max(1, Math.min(limit, 20)) },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: 1,
            slug: 1,
            price: 1,
            description_images: 1,
            category: {
              name: '$category.name',
              slug: '$category.slug',
            },
          },
        },
      ];

      const docs = await Product.aggregate(pipeline).exec();
      results = (docs as any[]).map((p) => ({
        _id: String(p._id),
        name: p.name,
        slug: p.slug,
        price: p.price,
        image: p.description_images?.find((img: any) => img?.cover_image)?.url || p.description_images?.[0]?.url,
        category: p.category?.name ? { name: p.category.name, slug: p.category.slug } : undefined,
      }));
    } catch (atlasErr) {
      // Fallback to regex search if $search is unavailable (e.g., index missing)
      const escaped = escapeRegex(q);
      const products = await Product.find({
        status: 'active',
        $or: [
          { name: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
          { tags: { $elemMatch: { $regex: escaped, $options: 'i' } } },
        ],
      })
        .select('name slug price description_images')
        .populate('category', 'name slug')
        .limit(Math.max(1, Math.min(limit, 20)))
        .lean();

      results = products.map((p: any) => ({
        _id: String(p._id),
        name: p.name,
        slug: p.slug,
        price: p.price,
        image: p.description_images?.find((img: any) => img?.cover_image)?.url || p.description_images?.[0]?.url,
        category: p.category ? { name: p.category.name, slug: p.category.slug } : undefined,
      }));
    }

    return { message: 'Autocomplete results retrieved successfully', data: results, code: 200 };
  } catch (error) {
    console.error('Error in search autocomplete:', error);
    return { message: 'Failed to fetch autocomplete results', data: null, code: 500 };
  }
};

/**
 * Get products from "Deals of the Day" campaign with pagination
 * Uses full aggregation pipeline for efficient campaign lookup and product fetching
 */
const getDealsOfTheDay = async (
  page = 1,
  limit = 20
): Promise<
  CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }>
> => {
  try {
    const skip = (page - 1) * limit;
    const now = new Date();

    // Single aggregation pipeline that:
    // 1. Looks up the active campaign
    // 2. Unwinds campaign products
    // 3. Looks up product details
    // 4. Adds sale and category information
    // 5. Paginates results
    const pipeline: PipelineStage[] = [
      // Step 1: Match the active "Deals of the Day" campaign
      {
        $match: {
          title: 'Deals of the Day',
          status: 'active',
        },
      },
      // Step 2: Limit to one campaign (should only be one anyway)
      { $limit: 1 },
      // Step 3: Unwind the products array to get individual product IDs
      { $unwind: '$products' },
      // Step 4: Lookup product details from products collection
      {
        $lookup: {
          from: 'products',
          localField: 'products',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      // Step 5: Unwind product details
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: false } },
      // Step 6: Filter out inactive products
      {
        $match: {
          'productDetails.status': 'active',
        },
      },
      // Step 7: Replace root with product details for cleaner structure
      { $replaceRoot: { newRoot: '$productDetails' } },
      // Step 8: Lookup category information
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Step 9: Add sale lookup
      ...addSaleLookupStages(),
      // Step 10: Project required fields and rename description_images to images
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          price: 1,
          createdAt: 1,
          sku: 1,
          stock: 1,
          originStock: 1,
          rating: 1,
          images: '$description_images', // Rename description_images to images
          sale: 1,
          attributes: 1,
          packSizes: 1,
          'category._id': 1,
          'category.name': 1,
          'category.slug': 1,
          'category.image': 1,
        },
      },
      // Step 11: Use facet for pagination and count in single aggregation
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'total' }],
        },
      },
      // Step 12: Project final structure
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$totalCount.total', 0] }, 0] },
        },
      },
    ];

    // Execute the aggregation on Campaign collection
    const Campaign = mongoose.model('Campaign');
    const agg = await Campaign.aggregate(pipeline).exec();

    // Extract results
    const products = (agg[0]?.data as ProductType[]) || [];
    const total = (agg[0]?.total as number) || 0;

    // If no results, campaign doesn't exist or has no products
    if (total === 0 && products.length === 0) {
      return {
        message: 'No active "Deals of the Day" campaign found or campaign has no active products',
        data: [],
        code: 404,
        meta: {
          total: 0,
          page,
          limit,
          pages: 0,
        },
      };
    }

    const pages = Math.ceil(total / limit);

    return {
      message: 'Deals of the Day products retrieved successfully',
      data: products,
      code: 200,
      meta: {
        total,
        page,
        limit,
        pages,
      },
    };
  } catch (error) {
    console.error('Error in getDealsOfTheDay:', error);
    return {
      message: 'Failed to fetch Deals of the Day products',
      data: [],
      code: 500,
      meta: {
        total: 0,
        page,
        limit,
        pages: 0,
      },
    };
  }
};

/**
 * Get products from a specific campaign with pagination and filtering
 * Uses full aggregation pipeline for efficient campaign lookup and product fetching
 *
 * @param campaignSlug - The campaign slug (supports hyphens, converts to underscores)
 * @param page - Page number for pagination
 * @param limit - Number of products per page
 * @param filters - Optional filters (price, tags, attributes, stock, packSize)
 * @param sort - Array of sort options in priority order
 */
type CampaignProductsFilters = {
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  attributes?: Record<string, string[]>;
  inStock?: boolean;
  packSize?: string;
};

type CampaignProductsData = {
  campaign: any; // Campaign document
  products: ProductType[];
};

const getProductsByCampaignSlug = async (
  campaignSlug: string,
  page = 1,
  limit = 20,
  sortOptions: Array<
    'alphabetical' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'stock' | 'order_frequency' | 'rating'
  > = ['alphabetical', 'newest'],
  filters?: CampaignProductsFilters
): Promise<
  CustomResponseTypeWithMeta<CampaignProductsData, { total: number; page: number; limit: number; pages: number }>
> => {
  try {
    const skip = (page - 1) * limit;

    // Normalize slug: convert hyphens to underscores for DB query
    const normalized = campaignSlug.trim().toLowerCase();

    // Single aggregation pipeline on Campaign collection
    const pipeline: PipelineStage[] = [
      // Step 1: Match the active campaign by slug
      {
        $match: {
          slug: normalized,
          status: 'active',
        },
      },
      // Step 2: Limit to one campaign
      { $limit: 1 },
      // Step 3: Validate date range (if dates exist)
      {
        $match: {
          $or: [
            { startDate: { $exists: false } },
            { endDate: { $exists: false } },
            {
              $and: [{ startDate: { $lte: new Date() } }, { endDate: { $gte: new Date() } }],
            },
          ],
        },
      },
      // Step 4: Unwind the products array to get individual product IDs
      { $unwind: '$products' },
      // Step 5: Lookup product details from products collection
      {
        $lookup: {
          from: 'products',
          localField: 'products',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      // Step 6: Unwind product details
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: false } },
      // Step 7: Filter out inactive products
      {
        $match: {
          'productDetails.status': 'active',
        },
      },
      // Step 8: Replace root with product details for cleaner structure
      { $replaceRoot: { newRoot: '$productDetails' } },
    ];

    // Step 9: Apply filters
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      const priceMatch: { $gte?: number; $lte?: number } = {};
      if (filters.minPrice !== undefined) priceMatch.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) priceMatch.$lte = filters.maxPrice;
      pipeline.push({ $match: { price: priceMatch } });
    }

    if (filters?.inStock) {
      pipeline.push({ $match: { stock: { $gt: 0 } } });
    }

    if (filters?.packSize) {
      pipeline.push({ $match: { 'packSizes.label': filters.packSize } });
    }

    if (filters?.tags && filters.tags.length > 0) {
      pipeline.push({ $match: { tags: { $in: filters.tags } } });
    }

    if (filters?.attributes && Object.keys(filters.attributes).length > 0) {
      // Inline attribute filtering: attribute name AND across attributes, OR within values
      const andExpr: unknown[] = Object.entries(filters.attributes).map(([attrName, values]) => ({
        $anyElementTrue: {
          $map: {
            input: '$attributes',
            as: 'attr',
            in: {
              $and: [
                { $eq: ['$$attr.name', attrName] },
                {
                  $anyElementTrue: {
                    $map: {
                      input: '$$attr.children',
                      as: 'child',
                      in: { $in: ['$$child.name', values] },
                    },
                  },
                },
              ],
            },
          },
        },
      }));
      pipeline.push({ $match: { $expr: { $and: andExpr } } });
    }

    // Step 10: Lookup category information
    pipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true,
        },
      }
    );

    // Step 11: Build sorting
    const sortStage: Record<string, 1 | -1> = {};

    for (const sortOption of sortOptions) {
      switch (sortOption) {
        case 'alphabetical':
          sortStage.name = 1;
          break;
        case 'newest':
          sortStage.createdAt = -1;
          break;
        case 'price_asc':
          sortStage.price = 1;
          break;
        case 'price_desc':
          sortStage.price = -1;
          break;
        case 'popular':
          sortStage.popularityScore = -1;
          break;
        case 'stock':
          sortStage.stock = -1;
          break;
        case 'order_frequency':
          sortStage.orderFrequency = -1;
          break;
        case 'rating':
          sortStage.rating = -1;
          break;
      }
    }

    if (Object.keys(sortStage).length) {
      pipeline.push({ $sort: sortStage });
    }

    // Step 12: Add sale lookup
    pipeline.push(...addSaleLookupStages());

    // Step 13: Project required fields and rename description_images to images
    pipeline.push({
      $project: {
        _id: 1,
        name: 1,
        slug: 1,
        price: 1,
        createdAt: 1,
        sku: 1,
        stock: 1,
        originStock: 1,
        rating: 1,
        images: '$description_images', // Rename description_images to images
        sale: 1,
        attributes: 1,
        packSizes: 1,
        'category._id': 1,
        'category.name': 1,
        'category.slug': 1,
        'category.image': 1,
      },
    });

    // Step 14: Use facet for pagination and count in single aggregation
    pipeline.push({
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'total' }],
      },
    });

    // Step 15: Project final structure
    pipeline.push({
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$totalCount.total', 0] }, 0] },
      },
    });

    // Execute the aggregation on Campaign collection
    const CampaignModel = mongoose.model('Campaign');
    const agg = await CampaignModel.aggregate(pipeline).exec();

    // Extract results
    const products = (agg[0]?.data as ProductType[]) || [];
    const total = (agg[0]?.total as number) || 0;

    // If no results, campaign doesn't exist or has no products
    if (total === 0 && products.length === 0) {
      return {
        message: 'No active campaign found or campaign has no active products',
        data: { campaign: null, products: [] } as any,
        code: 404,
        meta: {
          total: 0,
          page,
          limit,
          pages: 0,
        },
      };
    }

    const pages = Math.ceil(total / limit);

    // Fetch campaign metadata (should exist since we already validated in pipeline)
    const campaign = await CampaignModel.findOne({ slug: normalized, status: 'active' }).lean();

    if (!campaign) {
      return {
        message: 'Campaign not found or inactive',
        data: { campaign: null, products: [] } as any,
        code: 404,
        meta: {
          total: 0,
          page,
          limit,
          pages: 0,
        },
      };
    }

    return {
      message: 'Campaign products retrieved successfully',
      data: {
        campaign,
        products,
      },
      code: 200,
      meta: {
        total,
        page,
        limit,
        pages,
      },
    };
  } catch (error) {
    console.error('Error in getProductsByCampaignSlug:', error);
    return {
      message: 'Failed to fetch campaign products',
      data: { campaign: null, products: [] } as any,
      code: 500,
      meta: {
        total: 0,
        page,
        limit,
        pages: 0,
      },
    };
  }
};

/**
 * Get filter options for new products
 * Returns price range, attributes, tags, pack sizes aggregated from all active new products
 */
const getNewProductsFilters = async (): Promise<
  CustomResponseType<{
    priceRange: { min: number; max: number };
    attributes: Array<{ name: string; values: Array<{ value: string; count: number; colorCode?: string }> }>;
    specifications: Array<{ key: string; values: Array<{ value: string; count: number }> }>;
    tags: Array<{ value: string; count: number }>;
    packSizes: Array<{ label: string; count: number }>;
  }>
> => {
  try {
    const pipeline: PipelineStage[] = [
      { $match: { status: 'active' } },
      {
        $facet: {
          price: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],
          attributes: [
            { $unwind: { path: '$attributes', preserveNullAndEmptyArrays: false } },
            { $unwind: { path: '$attributes.children', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { name: '$attributes.name', value: '$attributes.children.name' },
                count: { $sum: 1 },
                colorCode: { $first: '$attributes.children.colorCode' },
              },
            },
            {
              $group: {
                _id: '$_id.name',
                values: {
                  $push: { value: '$_id.value', count: '$count', colorCode: '$colorCode' },
                },
              },
            },
            { $project: { _id: 0, name: '$_id', values: 1 } },
          ],
          specifications: [
            { $unwind: { path: '$specifications', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { key: '$specifications.key', value: '$specifications.value' },
                count: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: '$_id.key',
                values: { $push: { value: '$_id.value', count: '$count' } },
              },
            },
            { $project: { _id: 0, key: '$_id', values: 1 } },
          ],
          tags: [
            { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $project: { _id: 0, value: '$_id', count: 1 } },
          ],
          packSizes: [
            { $unwind: { path: '$packSizes', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$packSizes.label', count: { $sum: 1 } } },
            { $project: { _id: 0, label: '$_id', count: 1 } },
          ],
        },
      },
      {
        $project: {
          priceRange: {
            min: { $ifNull: [{ $arrayElemAt: ['$price.min', 0] }, 0] },
            max: { $ifNull: [{ $arrayElemAt: ['$price.max', 0] }, 0] },
          },
          attributes: 1,
          specifications: 1,
          tags: 1,
          packSizes: 1,
        },
      },
    ];

    const agg = await Product.aggregate(pipeline).allowDiskUse(true);
    const payload = agg[0] || {
      priceRange: { min: 0, max: 0 },
      attributes: [],
      specifications: [],
      tags: [],
      packSizes: [],
    };

    return { message: 'New products filters retrieved successfully', data: payload, code: 200 };
  } catch (error) {
    console.error('Error building new products filters:', error);
    return { message: 'Failed to retrieve new products filters', data: null, code: 500 };
  }
};

/**
 * Get filter options for week products (products sold in last 7 days)
 */
const getWeekProductsFilters = async (): Promise<
  CustomResponseType<{
    priceRange: { min: number; max: number };
    attributes: Array<{ name: string; values: Array<{ value: string; count: number; colorCode?: string }> }>;
    specifications: Array<{ key: string; values: Array<{ value: string; count: number }> }>;
    tags: Array<{ value: string; count: number }>;
    packSizes: Array<{ label: string; count: number }>;
  }>
> => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    // Get product IDs sold in last 7 days
    const soldProductsPipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: weekStart }, status: 'Completed' } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product' } },
    ];

    const soldProducts = await Order.aggregate(soldProductsPipeline).exec();
    const productIds = soldProducts.map((p) => p._id);

    if (productIds.length === 0) {
      return {
        message: 'No week products found',
        data: {
          priceRange: { min: 0, max: 0 },
          attributes: [],
          specifications: [],
          tags: [],
          packSizes: [],
        },
        code: 200,
      };
    }

    const pipeline: PipelineStage[] = [
      { $match: { _id: { $in: productIds }, status: 'active' } },
      {
        $facet: {
          price: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],
          attributes: [
            { $unwind: { path: '$attributes', preserveNullAndEmptyArrays: false } },
            { $unwind: { path: '$attributes.children', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { name: '$attributes.name', value: '$attributes.children.name' },
                count: { $sum: 1 },
                colorCode: { $first: '$attributes.children.colorCode' },
              },
            },
            {
              $group: {
                _id: '$_id.name',
                values: {
                  $push: { value: '$_id.value', count: '$count', colorCode: '$colorCode' },
                },
              },
            },
            { $project: { _id: 0, name: '$_id', values: 1 } },
          ],
          specifications: [
            { $unwind: { path: '$specifications', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { key: '$specifications.key', value: '$specifications.value' },
                count: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: '$_id.key',
                values: { $push: { value: '$_id.value', count: '$count' } },
              },
            },
            { $project: { _id: 0, key: '$_id', values: 1 } },
          ],
          tags: [
            { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $project: { _id: 0, value: '$_id', count: 1 } },
          ],
          packSizes: [
            { $unwind: { path: '$packSizes', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$packSizes.label', count: { $sum: 1 } } },
            { $project: { _id: 0, label: '$_id', count: 1 } },
          ],
        },
      },
      {
        $project: {
          priceRange: {
            min: { $ifNull: [{ $arrayElemAt: ['$price.min', 0] }, 0] },
            max: { $ifNull: [{ $arrayElemAt: ['$price.max', 0] }, 0] },
          },
          attributes: 1,
          specifications: 1,
          tags: 1,
          packSizes: 1,
        },
      },
    ];

    const agg = await Product.aggregate(pipeline).allowDiskUse(true);
    const payload = agg[0] || {
      priceRange: { min: 0, max: 0 },
      attributes: [],
      specifications: [],
      tags: [],
      packSizes: [],
    };

    return { message: 'Week products filters retrieved successfully', data: payload, code: 200 };
  } catch (error) {
    console.error('Error building week products filters:', error);
    return { message: 'Failed to retrieve week products filters', data: null, code: 500 };
  }
};

/**
 * Get filter options for top sold products
 */
const getTopSoldProductsFilters = async (): Promise<
  CustomResponseType<{
    priceRange: { min: number; max: number };
    attributes: Array<{ name: string; values: Array<{ value: string; count: number; colorCode?: string }> }>;
    specifications: Array<{ key: string; values: Array<{ value: string; count: number }> }>;
    tags: Array<{ value: string; count: number }>;
    packSizes: Array<{ label: string; count: number }>;
  }>
> => {
  try {
    // Get product IDs from all completed orders
    const soldProductsPipeline: PipelineStage[] = [
      { $match: { status: 'Completed' } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product' } },
    ];

    const soldProducts = await Order.aggregate(soldProductsPipeline).exec();
    const productIds = soldProducts.map((p) => p._id);

    if (productIds.length === 0) {
      return {
        message: 'No top sold products found',
        data: {
          priceRange: { min: 0, max: 0 },
          attributes: [],
          specifications: [],
          tags: [],
          packSizes: [],
        },
        code: 200,
      };
    }

    const pipeline: PipelineStage[] = [
      { $match: { _id: { $in: productIds }, status: 'active' } },
      {
        $facet: {
          price: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],
          attributes: [
            { $unwind: { path: '$attributes', preserveNullAndEmptyArrays: false } },
            { $unwind: { path: '$attributes.children', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { name: '$attributes.name', value: '$attributes.children.name' },
                count: { $sum: 1 },
                colorCode: { $first: '$attributes.children.colorCode' },
              },
            },
            {
              $group: {
                _id: '$_id.name',
                values: {
                  $push: { value: '$_id.value', count: '$count', colorCode: '$colorCode' },
                },
              },
            },
            { $project: { _id: 0, name: '$_id', values: 1 } },
          ],
          specifications: [
            { $unwind: { path: '$specifications', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { key: '$specifications.key', value: '$specifications.value' },
                count: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: '$_id.key',
                values: { $push: { value: '$_id.value', count: '$count' } },
              },
            },
            { $project: { _id: 0, key: '$_id', values: 1 } },
          ],
          tags: [
            { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $project: { _id: 0, value: '$_id', count: 1 } },
          ],
          packSizes: [
            { $unwind: { path: '$packSizes', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$packSizes.label', count: { $sum: 1 } } },
            { $project: { _id: 0, label: '$_id', count: 1 } },
          ],
        },
      },
      {
        $project: {
          priceRange: {
            min: { $ifNull: [{ $arrayElemAt: ['$price.min', 0] }, 0] },
            max: { $ifNull: [{ $arrayElemAt: ['$price.max', 0] }, 0] },
          },
          attributes: 1,
          specifications: 1,
          tags: 1,
          packSizes: 1,
        },
      },
    ];

    const agg = await Product.aggregate(pipeline).allowDiskUse(true);
    const payload = agg[0] || {
      priceRange: { min: 0, max: 0 },
      attributes: [],
      specifications: [],
      tags: [],
      packSizes: [],
    };

    return { message: 'Top sold products filters retrieved successfully', data: payload, code: 200 };
  } catch (error) {
    console.error('Error building top sold products filters:', error);
    return { message: 'Failed to retrieve top sold products filters', data: null, code: 500 };
  }
};

/**
 * Search products with full ProductType data and filters (for /search-result page)
 * Returns full product data with category, sales info, etc. for grid display
 */
const searchProductsWithFilters = async (params: {
  query?: string;
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  packSize?: string;
  tags?: string[];
  attributes?: Record<string, string[]>;
  sortBy?: 'price' | 'name' | 'createdAt' | 'rating' | 'sales';
  sortOrder?: 'asc' | 'desc';
}): Promise<
  CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }>
> => {
  try {
    const {
      query = '',
      page = 1,
      limit = 12,
      minPrice,
      maxPrice,
      inStock,
      packSize,
      tags,
      attributes,
      sortBy,
      sortOrder = 'desc',
    } = params;

    // Build filter pipeline
    type AndFilter = Array<Record<string, unknown>>;
    const filterConditions: { $and: AndFilter } = {
      $and: [{ status: 'active' }],
    };

    // Search filter (if query provided)
    if (query) {
      filterConditions.$and.push({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { brand: { $regex: query, $options: 'i' } },
          { tags: { $elemMatch: { $regex: query, $options: 'i' } } },
        ],
      });
    }

    // Price filters
    if (minPrice !== undefined) {
      filterConditions.$and.push({ price: { $gte: minPrice } });
    }
    if (maxPrice !== undefined) {
      filterConditions.$and.push({ price: { $lte: maxPrice } });
    }

    // In stock filter
    if (inStock) {
      filterConditions.$and.push({ $expr: { $gt: ['$stock', 0] } });
    }

    // Pack size filter
    if (packSize) {
      filterConditions.$and.push({
        packSizes: { $elemMatch: { label: packSize } },
      });
    }

    // Tags filter
    if (tags && tags.length > 0) {
      filterConditions.$and.push({ tags: { $in: tags } });
    }

    // Attributes filter (Color, Size, etc.)
    if (attributes && Object.keys(attributes).length > 0) {
      Object.entries(attributes).forEach(([attrName, attrValues]) => {
        if (attrValues.length > 0) {
          filterConditions.$and.push({
            attributes: {
              $elemMatch: {
                name: attrName,
                'children.name': { $in: attrValues },
              },
            },
          });
        }
      });
    }

    // Build sort object
    const sortObj: Record<string, 1 | -1> = {};
    if (sortBy === 'price') {
      sortObj.price = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'name') {
      sortObj.name = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sortObj.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'rating') {
      sortObj.rating = sortOrder === 'asc' ? 1 : -1;
    } else {
      // Default: newest first
      sortObj.createdAt = -1;
    }

    const pipeline: PipelineStage[] = [
      { $match: filterConditions },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'sales',
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$product', '$$productId'] }, { $eq: ['$isActive', true] }],
                },
              },
            },
          ],
          as: 'sale',
        },
      },
      { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } },
      { $sort: sortObj },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
    ];

    const result = await Product.aggregate(pipeline).allowDiskUse(true);
    const total = result[0]?.metadata[0]?.total || 0;
    const products = result[0]?.data || [];

    return {
      message: 'Search results retrieved successfully',
      data: products,
      code: 200,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Error in searchProductsWithFilters:', error);
    return {
      message: 'Failed to retrieve search results',
      data: [],
      code: 500,
      meta: { total: 0, page: 1, limit: 12, pages: 0 },
    };
  }
};

/**
 * Get filter aggregations for search results
 * Returns available filter options based on search query
 */
const getSearchFilters = async (
  query?: string
): Promise<
  CustomResponseType<{
    priceRange: { min: number; max: number };
    attributes: Array<{ name: string; values: Array<{ value: string; count: number; colorCode?: string }> }>;
    specifications: Array<{ key: string; values: Array<{ value: string; count: number }> }>;
    tags: Array<{ value: string; count: number }>;
    packSizes: Array<{ label: string; count: number }>;
  }>
> => {
  try {
    // Build match condition
    type AndFilter = Array<Record<string, unknown>>;
    const matchCondition: { $and: AndFilter } = {
      $and: [{ status: 'active' }],
    };

    // Add search filter if query provided
    if (query) {
      matchCondition.$and.push({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { brand: { $regex: query, $options: 'i' } },
          { tags: { $elemMatch: { $regex: query, $options: 'i' } } },
        ],
      });
    }

    const pipeline: PipelineStage[] = [
      { $match: matchCondition },
      {
        $facet: {
          price: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],
          attributes: [
            { $unwind: { path: '$attributes', preserveNullAndEmptyArrays: false } },
            { $unwind: { path: '$attributes.children', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { name: '$attributes.name', value: '$attributes.children.name' },
                count: { $sum: 1 },
                colorCode: { $first: '$attributes.children.colorCode' },
              },
            },
            {
              $group: {
                _id: '$_id.name',
                values: {
                  $push: { value: '$_id.value', count: '$count', colorCode: '$colorCode' },
                },
              },
            },
            { $project: { _id: 0, name: '$_id', values: 1 } },
          ],
          specifications: [
            { $unwind: { path: '$specifications', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: { key: '$specifications.key', value: '$specifications.value' },
                count: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: '$_id.key',
                values: { $push: { value: '$_id.value', count: '$count' } },
              },
            },
            { $project: { _id: 0, key: '$_id', values: 1 } },
          ],
          tags: [
            { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $project: { _id: 0, value: '$_id', count: 1 } },
          ],
          packSizes: [
            { $unwind: { path: '$packSizes', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$packSizes.label', count: { $sum: 1 } } },
            { $project: { _id: 0, label: '$_id', count: 1 } },
          ],
        },
      },
      {
        $project: {
          priceRange: {
            min: { $ifNull: [{ $arrayElemAt: ['$price.min', 0] }, 0] },
            max: { $ifNull: [{ $arrayElemAt: ['$price.max', 0] }, 0] },
          },
          attributes: 1,
          specifications: 1,
          tags: 1,
          packSizes: 1,
        },
      },
    ];

    const agg = await Product.aggregate(pipeline).allowDiskUse(true);
    const payload = agg[0] || {
      priceRange: { min: 0, max: 0 },
      attributes: [],
      specifications: [],
      tags: [],
      packSizes: [],
    };

    return { message: 'Search filters retrieved successfully', data: payload, code: 200 };
  } catch (error) {
    console.error('Error building search filters:', error);
    return { message: 'Failed to retrieve search filters', data: null, code: 500 };
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
  getNewProducts,
  searchAutocomplete,
  getDealsOfTheDay,
  getProductsByCampaignSlug,
  getNewProductsFilters,
  getWeekProductsFilters,
  getTopSoldProductsFilters,
  searchProductsWithFilters,
  getSearchFilters,
};

export default ProductService;
