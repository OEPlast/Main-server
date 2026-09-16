import { CustomResponsePromise } from '@/types';
import Order from '@/models/Order';
import Transaction from '@/models/Transaction';
import Review from '@/models/Review';
import Product from '@/models/Product';
import mongoose from 'mongoose';
import { escapeRegex } from '@/helpers/regex';

/**
 * Get top products by revenue (bar chart)
 */
const getTopProductsRevenue = async ({
  from,
  to,
  limit = 10,
}: {
  from: Date;
  to: Date;
  limit?: number;
}): CustomResponsePromise<
  Array<{ productId: string; productName: string; coverImage: string | null; revenue: number }>
> => {
  try {
    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product',
          revenue: { $sum: { $multiply: ['$products.price', '$products.qty'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      // Only filter out if product is completely missing
      {
        $match: {
          product: { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          coverImage: {
            $let: {
              vars: {
                coverImg: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$product.description_images',
                        cond: { $eq: ['$$this.cover_image', true] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: { $ifNull: ['$$coverImg.url', null] },
            },
          },
          revenue: 1,
        },
      },
    ]);

    return {
      message: 'Top products by revenue fetched successfully',
      data: result,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getTopProductsRevenue:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get categories performance
 */
const getCategoriesPerformance = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<
  Array<{ categoryId: string; name: string; image: string; revenue: number; orders: number }>
> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'category.name': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$category._id',
          categoryName: { $first: '$category.name' },
          categoryImage: { $first: '$category.image' },
          revenue: { $sum: { $multiply: ['$products.price', '$products.qty'] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $project: {
          categoryId: '$_id',
          name: '$categoryName',
          image: '$categoryImage',
          revenue: 1,
          orders: 1,
        },
      },
    ]);

    return {
      message: 'Categories performance fetched successfully',
      data: result,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getCategoriesPerformance:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get orders table with pagination and filters
 */
const getOrdersTable = async ({
  from,
  to,
  page = 1,
  limit = 10,
  status,
  sortBy = 'createdAt',
  sortOrder = 'desc',
}: {
  from: Date;
  to: Date;
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}): CustomResponsePromise<{
  data: any[];
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const matchQuery: Record<string, unknown> = { createdAt: { $gte: from, $lte: to } };

    if (status) {
      if (status !== 'all') {
        // do nothing
        matchQuery.status = status;
      }
    } else {
      matchQuery.status = { $in: ['Processing', 'Failed'] };
    }

    const orders = await Order.find(matchQuery)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email')
      .lean();

    const totalRecords = await Order.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limit);

    // Map 'total' field to 'totalAmount' for frontend compatibility
    const mappedOrders = orders.map((order: any) => ({
      ...order,
      totalAmount: order.total,
    }));

    return {
      message: 'Orders table fetched successfully',
      data: {
        data: mappedOrders,
        pagination: { currentPage: page, totalPages, totalRecords },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getOrdersTable:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get transactions table with pagination and filters
 */
const getTransactionsTable = async ({
  from,
  to,
  page = 1,
  limit = 10,
  status,
  method,
  sortBy = 'createdAt',
  sortOrder = 'desc',
}: {
  from: Date;
  to: Date;
  page?: number;
  limit?: number;
  status?: string;
  method?: string;
  sortBy?: string;
  sortOrder?: string;
}): CustomResponsePromise<{
  data: any[];
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const matchQuery: any = { createdAt: { $gte: from, $lte: to } };
    if (status) {
      matchQuery.status = status;
    }
    if (method) {
      matchQuery.paymentMethod = method;
    }

    const transactions = await Transaction.find(matchQuery)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'firstName lastName email')
      .lean();

    const totalRecords = await Transaction.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: 'Transactions table fetched successfully',
      data: {
        data: transactions,
        pagination: { currentPage: page, totalPages, totalRecords },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getTransactionsTable:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get product performance table
 */
const getProductPerformance = async ({
  from,
  to,
  page = 1,
  limit = 10,
  sortBy = 'revenue',
  sortOrder = 'desc',
  search,
}: {
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
}): CustomResponsePromise<{
  data: Array<{
    productId: string;
    productName: string;
    coverImage: string | null;
    revenue: number;
    unitsSold: number;
    averageRating: number;
    reviewCount: number;
  }>;
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Build product search match
    const productMatch: Record<string, unknown> = {};
    const and: Record<string, unknown>[] = [];

    if (search) {
      const searchTerm = search.trim();
      const rx = new RegExp(escapeRegex(searchTerm), 'i');
      const searchConditions: Record<string, unknown>[] = [
        { name: rx },
        { sku: isNaN(Number(searchTerm)) ? -1 : Number(searchTerm) },
      ];
      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(searchTerm) });
      }
      and.push({ $or: searchConditions });
    }
    if (and.length) productMatch.$and = and;

    // Build order match stage for date filtering
    const orderMatch: Record<string, unknown> = {};
    if (from && to) {
      orderMatch.createdAt = { $gte: from, $lte: to };
    } else if (from) {
      orderMatch.createdAt = { $gte: from };
    } else if (to) {
      orderMatch.createdAt = { $lte: to };
    }

    // Main aggregation: always include $match, even if empty
    const result = await Product.aggregate([
      { $match: productMatch },
      {
        $lookup: {
          from: 'orders',
          let: { productId: '$_id' },
          pipeline: [
            { $match: { ...orderMatch } },
            { $unwind: '$products' },
            { $match: { $expr: { $eq: ['$products.product', '$$productId'] } } },
            {
              $group: {
                _id: null,
                revenue: { $sum: { $multiply: ['$products.price', '$products.qty'] } },
                unitsSold: { $sum: '$products.qty' },
              },
            },
          ],
          as: 'orderStats',
        },
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'product',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          revenue: { $ifNull: [{ $arrayElemAt: ['$orderStats.revenue', 0] }, 0] },
          unitsSold: { $ifNull: [{ $arrayElemAt: ['$orderStats.unitsSold', 0] }, 0] },
          averageRating: { $ifNull: [{ $avg: '$reviews.rating' }, 0] },
          reviewCount: { $size: '$reviews' },
          coverImage: {
            $let: {
              vars: {
                coverImg: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$description_images',
                        cond: { $eq: ['$$this.cover_image', true] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: { $ifNull: ['$$coverImg.url', null] },
            },
          },
        },
      },
      {
        $project: {
          productId: '$_id',
          productName: '$name',
          coverImage: 1,
          revenue: 1,
          unitsSold: 1,
          averageRating: 1,
          reviewCount: 1,
        },
      },
      { $sort: { [sortBy]: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Get total count of products for pagination (with search)
    const totalRecords = await Product.countDocuments(productMatch);
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: 'Product performance fetched successfully',
      data: {
        data: result,
        pagination: { currentPage: page, totalPages, totalRecords },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getProductPerformance:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get reviews table with pagination and filters
 */
const getReviewsTable = async ({
  from,
  to,
  page = 1,
  limit = 10,
  rating,
  status,
  sortBy = 'createdAt',
}: {
  from: Date;
  to: Date;
  page?: number;
  limit?: number;
  rating?: number;
  status?: string;
  sortBy?: string;
}): CustomResponsePromise<{
  data: any[];
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    const skip = (page - 1) * limit;

    const matchQuery: any = { createdAt: { $gte: from, $lte: to } };
    if (rating) {
      matchQuery.rating = rating;
    }
    if (status) {
      matchQuery.status = status;
    }

    const reviews = await Review.find(matchQuery)
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reviewBy', 'firstName lastName email')
      .populate('product', 'name')
      .lean();

    const totalRecords = await Review.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRecords / limit);

    // Map 'review' field to 'comment' and 'isApproved' to 'status' for frontend compatibility
    const mappedReviews = reviews.map((review: any) => ({
      ...review,
      comment: review.review || '', // Map review -> comment
      status: review.isApproved ? 'Approved' : 'Pending', // Map isApproved -> status
    }));

    return {
      message: 'Reviews table fetched successfully',
      data: {
        data: mappedReviews,
        pagination: { currentPage: page, totalPages, totalRecords },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getReviewsTable:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

const Admin_AnalyticsService = {
  getTopProductsRevenue,
  getCategoriesPerformance,
  getOrdersTable,
  getTransactionsTable,
  getProductPerformance,
  getReviewsTable,
};

export default Admin_AnalyticsService;
