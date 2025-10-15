import Statistics, { StatisticsType } from '@/models/Statistics';
import { CustomResponsePromise } from '@/types';
import Order from '@/models/Order';
import Transaction from '@/models/Transaction';
import Shipment from '@/models/Shipment';
import User from '@/models/User';
import Wishlist from '@/models/wishlist';
import Review from '@/models/Review';
import CouponRedemption from '@/models/CouponRedemption';
import Cart from '@/models/Cart';
import Product from '@/models/Product';

type AnalyticsResult = {
  _id: Record<string, unknown>;
  count?: number;
  totalAmount?: number;
  totalDiscount?: number;
  averageRating?: number;
  revenue?: number;
  returns?: number;
  totalRevenue?: number;
  totalItems?: number;
};

/**
 * Fetches seller statistics (revenue and profit) for a given date range.
 */
const getSellerStatistics = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ revenue: number; profit: number }> => {
  try {
    const stats = await Statistics.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null, //group specifications must include ID's
          revenue: { $sum: '$totalRevenue' },
          profit: { $sum: { $subtract: ['$totalRevenue', '$totalAmount'] } },
        },
      },
    ]);

    return {
      message: 'Seller statistics fetched successfully',
      data: stats[0] || { revenue: 0, profit: 0 },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching seller statistics:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches total sales (revenue and profit) for a given date range.
 */
const getTotalSales = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ revenue: number; profit: number }> => {
  try {
    const sales = await Statistics.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          sales: { $sum: '$totalSales' },
          revenue: { $sum: '$totalRevenue' },
          profit: { $sum: { $subtract: ['$totalRevenue', '$totalAmount'] } },
        },
      },
    ]);

    return {
      message: 'Total sales fetched successfully',
      data: sales[0] || { revenue: 0, profit: 0 },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching total sales:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches a chart for a given metric over a specified date range.
 */
const getChartData = async ({
  metric,
  from,
  to,
}: {
  metric: string;
  from: Date;
  to: Date;
}): CustomResponsePromise<{ date: string; value: number }[]> => {
  try {
    const data = await Statistics.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          value: { $sum: `$${metric}` },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          value: 1,
        },
      },
    ]);

    return {
      message: 'Chart data fetched successfully',
      data,
      code: 200,
    };
  } catch (error) {
    console.error(`Error fetching chart data for ${metric}:`, error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order vs. return statistics for a given date range.
 */
const getOrderVsReturns = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ date: string; orders: number; returns: number }[]> => {
  try {
    const data = await Statistics.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalOrders: { $sum: '$totalOrders' },
          totalReturns: { $sum: '$totalReturns' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      message: 'Order vs. returns data fetched successfully',
      data: data.map((entry) => ({
        date: entry._id,
        orders: entry.totalOrders,
        returns: entry.totalReturns,
      })),
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching order vs. returns data:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches daily counts for orders, revenue, sales, and returns over a specified date range.
 */
const getRangeCount = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ date: string; orders: number; revenue: number; sales: number; returns: number }[]> => {
  try {
    const data = await Statistics.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          orderCount: { $sum: '$totalOrders' },
          revenueCount: { $sum: '$totalRevenue' },
          salesCount: { $sum: '$totalAmount' },
          returnCount: { $sum: '$totalReturns' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      message: 'Range count data fetched successfully',
      data: data.map((entry) => ({
        date: entry._id,
        orders: entry.orderCount,
        revenue: entry.revenueCount,
        sales: entry.salesCount,
        returns: entry.returnCount,
      })),
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching daily counts:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches paginated statistics data for a given date range.
 */
const getPaginatedStatisticsDays = async ({
  from,
  to,
  page = 1,
  limit = 50,
}: {
  from: Date;
  to: Date;
  page: number;
  limit?: number;
}): CustomResponsePromise<{
  data: StatisticsType[];
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    const skip = (page - 1) * limit;
    const data = await Statistics.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      { $sort: { date: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalRecords = await Statistics.countDocuments({ date: { $gte: from, $lte: to } });
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: 'Paginated statistics fetched successfully',
      data: {
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching paginated statistics:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches paginated statistics data grouped by weeks for a given date range.
 */
const getPaginatedStatisticsWeeks = async ({
  from,
  to,
  page = 1,
  limit = 50,
}: {
  from: Date;
  to: Date;
  page: number;
  limit?: number;
}): CustomResponsePromise<{
  data: StatisticsType[];
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    const skip = (page - 1) * limit;
    const data = await Statistics.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $isoWeek: '$date' },
          revenue: { $sum: '$totalRevenue' },
          profit: { $sum: { $subtract: ['$totalRevenue', '$totalAmount'] } },
        },
      },
      { $sort: { _id: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalRecords = await Statistics.countDocuments({ date: { $gte: from, $lte: to } });
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: 'Paginated weekly statistics fetched successfully',
      data: {
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching paginated weekly statistics:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches paginated statistics data grouped by months for a given date range.
 */
const getPaginatedStatisticsMonths = async ({
  from,
  to,
  page = 1,
  limit = 50,
}: {
  from: Date;
  to: Date;
  page: number;
  limit?: number;
}): CustomResponsePromise<{
  data: StatisticsType[];
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    const skip = (page - 1) * limit;
    const data = await Statistics.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $month: '$date' },
          revenue: { $sum: '$totalRevenue' },
          profit: { $sum: { $subtract: ['$totalRevenue', '$totalAmount'] } },
        },
      },
      { $sort: { _id: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalRecords = await Statistics.countDocuments({ date: { $gte: from, $lte: to } });
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: 'Paginated monthly statistics fetched successfully',
      data: {
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching paginated monthly statistics:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches paginated statistics data grouped by years for a given date range.
 */
const getPaginatedStatisticsYears = async ({
  from,
  to,
  page = 1,
  limit = 50,
}: {
  from: Date;
  to: Date;
  page: number;
  limit?: number;
}): CustomResponsePromise<{
  data: StatisticsType[];
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    const skip = (page - 1) * limit;
    const data = await Statistics.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $year: '$date' },
          revenue: { $sum: '$totalRevenue' },
          profit: { $sum: { $subtract: ['$totalRevenue', '$totalAmount'] } },
        },
      },
      { $sort: { _id: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalRecords = await Statistics.countDocuments({ date: { $gte: from, $lte: to } });
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: 'Paginated yearly statistics fetched successfully',
      data: {
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching paginated yearly statistics:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches wishlist frequency analytics by days for a given date range.
 */
const getWishlistFrequencyByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Wishlist.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Wishlist frequency by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches wishlist frequency analytics by months for a given date range.
 */
const getWishlistFrequencyByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Wishlist.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Wishlist frequency by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches wishlist frequency analytics by years for a given date range.
 */
const getWishlistFrequencyByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Wishlist.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Wishlist frequency by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches orders analytics by days for a given date range.
 */
const getOrdersByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Orders by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches orders analytics by months for a given date range.
 */
const getOrdersByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Orders by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches orders analytics by years for a given date range.
 */
const getOrdersByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Orders by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order cancelled analytics by days for a given date range.
 */
const getOrderCancelledByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Cancelled' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Order cancelled by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order cancelled analytics by months for a given date range.
 */
const getOrderCancelledByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Cancelled' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Order cancelled by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order cancelled analytics by years for a given date range.
 */
const getOrderCancelledByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Cancelled' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Order cancelled by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches shipments delivered analytics by days for a given date range.
 */
const getShipmentsDeliveredByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Shipment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Delivered' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Shipments delivered by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches shipments delivered analytics by months for a given date range.
 */
const getShipmentsDeliveredByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Shipment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Delivered' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Shipments delivered by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches shipments delivered analytics by years for a given date range.
 */
const getShipmentsDeliveredByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Shipment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Delivered' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Shipments delivered by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order returned analytics by days for a given date range.
 */
const getOrderReturnedByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return { message: 'Success', data: { data: result, total }, code: 200 };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order returned analytics by months for a given date range.
 */
const getOrderReturnedByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return { message: 'Success', data: { data: result, total }, code: 200 };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order returned analytics by years for a given date range.
 */
const getOrderReturnedByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return { message: 'Success', data: { data: result, total }, code: 200 };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order failed analytics by days for a given date range.
 */
const getOrderFailedByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Pending' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Order failed by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order failed analytics by months for a given date range.
 */
const getOrderFailedByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Pending' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Order failed by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches order failed analytics by years for a given date range.
 */
const getOrderFailedByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Pending' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Order failed by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches shipments in warehouse analytics by days for a given date range.
 */
const getShipmentsInWarehouseByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Shipment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'In-Warehouse' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Shipments in warehouse by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches shipments in warehouse analytics by months for a given date range.
 */
const getShipmentsInWarehouseByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Shipment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'In-Warehouse' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Shipments in warehouse by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches shipments in warehouse analytics by years for a given date range.
 */
const getShipmentsInWarehouseByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Shipment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'In-Warehouse' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Shipments in warehouse by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches transactions analytics by days for a given date range.
 */
const getTransactionsByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            status: '$status',
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
          status: { $ifNull: ['$status', ''] },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
          totalAmount: 1,
          status: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1, status: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Transactions by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches transactions analytics by months for a given date range.
 */
const getTransactionsByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            status: '$status',
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          status: { $ifNull: ['$status', ''] },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
          totalAmount: 1,
          status: 1,
        },
      },
      { $sort: { year: 1, month: 1, status: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Transactions by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches transactions analytics by years for a given date range.
 */
const getTransactionsByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            status: '$status',
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          year: { $year: '$date' },
          status: { $ifNull: ['$status', ''] },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
          totalAmount: 1,
          status: 1,
        },
      },
      { $sort: { year: 1, status: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Transactions by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches total transactions analytics by days for a given date range.
 */
const getTotalTransactionsByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
          totalAmount: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Total transactions by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches total transactions analytics by months for a given date range.
 */
const getTotalTransactionsByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
          totalAmount: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Total transactions by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches total transactions analytics by years for a given date range.
 */
const getTotalTransactionsByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
          totalAmount: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Total transactions by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches user joining rate analytics by days for a given date range.
 */
const getUserJoiningRateByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await User.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'User joining rate by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches user joining rate analytics by months for a given date range.
 */
const getUserJoiningRateByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await User.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'User joining rate by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches user joining rate analytics by years for a given date range.
 */
const getUserJoiningRateByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await User.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'User joining rate by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches coupon redemption analytics by days for a given date range.
 */
const getCouponRedemptionByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await CouponRedemption.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          totalDiscount: { $sum: '$amountDiscounted' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalDiscount: { $ifNull: ['$totalDiscount', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
          totalDiscount: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Coupon redemption by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches coupon redemption analytics by months for a given date range.
 */
const getCouponRedemptionByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await CouponRedemption.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          totalDiscount: { $sum: '$amountDiscounted' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalDiscount: { $ifNull: ['$totalDiscount', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
          totalDiscount: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Coupon redemption by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches coupon redemption analytics by years for a given date range.
 */
const getCouponRedemptionByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await CouponRedemption.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
          totalDiscount: { $sum: '$amountDiscounted' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalDiscount: { $ifNull: ['$totalDiscount', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
          totalDiscount: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Coupon redemption by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches reviews analytics by days for a given date range.
 */
const getReviewsByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Reviews by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches reviews analytics by months for a given date range.
 */
const getReviewsByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Reviews by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches reviews analytics by years for a given date range.
 */
const getReviewsByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Reviews by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches review rate analytics by days for a given date range.
 */
const getReviewRateByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          averageRating: { $ifNull: ['$averageRating', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
          averageRating: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Review rate by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches review rate analytics by months for a given date range.
 */
const getReviewRateByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          averageRating: { $ifNull: ['$averageRating', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
          averageRating: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Review rate by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches review rate analytics by years for a given date range.
 */
const getReviewRateByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          averageRating: { $ifNull: ['$averageRating', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
          averageRating: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Review rate by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches review mood analytics by days for a given date range.
 */
const getReviewMoodByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            rating: '$rating',
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
          rating: { $ifNull: ['$rating', 0] },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
          rating: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1, rating: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Review mood by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches review mood analytics by months for a given date range.
 */
const getReviewMoodByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            rating: '$rating',
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          rating: { $ifNull: ['$rating', 0] },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
          rating: 1,
        },
      },
      { $sort: { year: 1, month: 1, rating: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Review mood by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches review mood analytics by years for a given date range.
 */
const getReviewMoodByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            rating: '$rating',
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          rating: { $ifNull: ['$rating', 0] },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
          rating: 1,
        },
      },
      { $sort: { year: 1, rating: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Review mood by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches revenue analytics by days for a given date range.
 */
const getRevenueByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          totalRevenue: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          totalRevenue: { $ifNull: ['$totalRevenue', 0] },
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          totalRevenue: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Revenue by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches revenue analytics by months for a given date range.
 */
const getRevenueByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          totalRevenue: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          totalRevenue: { $ifNull: ['$totalRevenue', 0] },
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          totalRevenue: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Revenue by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches revenue analytics by years for a given date range.
 */
const getRevenueByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          totalRevenue: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          totalRevenue: { $ifNull: ['$totalRevenue', 0] },
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          totalRevenue: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Revenue by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches products added analytics by days for a given date range.
 */
const getProductsAddedByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Product.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Products added by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches products added analytics by months for a given date range.
 */
const getProductsAddedByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Product.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Products added by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches products added analytics by years for a given date range.
 */
const getProductsAddedByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Product.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Products added by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches current carts analytics by days for a given date range.
 */
const getCurrentCartsByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Cart.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'active' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          totalItems: { $sum: { $size: '$items' } },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalItems: { $ifNull: ['$totalItems', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
          totalItems: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Current carts by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches current carts analytics by months for a given date range.
 */
const getCurrentCartsByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Cart.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'active' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          totalItems: { $sum: { $size: '$items' } },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalItems: { $ifNull: ['$totalItems', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
          totalItems: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Current carts by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches current carts analytics by years for a given date range.
 */
const getCurrentCartsByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Cart.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'active' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
          totalItems: { $sum: { $size: '$items' } },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalItems: { $ifNull: ['$totalItems', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
          totalItems: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Current carts by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches sales analytics by days for a given date range.
 */
const getSalesByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: 'Completed',
          $or: [{ couponDiscount: { $gt: 0 } }, { 'flashSaleApplied.0': { $exists: true } }],
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          totalSalesAmount: { $sum: { $add: ['$couponDiscount', { $sum: '$flashSaleApplied.discount' }] } },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalSalesAmount: { $ifNull: ['$totalSalesAmount', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          count: 1,
          totalSalesAmount: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Sales by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches sales analytics by months for a given date range.
 */
const getSalesByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: 'Completed',
          $or: [{ couponDiscount: { $gt: 0 } }, { 'flashSaleApplied.0': { $exists: true } }],
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          totalSalesAmount: { $sum: { $add: ['$couponDiscount', { $sum: '$flashSaleApplied.discount' }] } },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalSalesAmount: { $ifNull: ['$totalSalesAmount', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          count: 1,
          totalSalesAmount: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Sales by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches sales analytics by years for a given date range.
 */
const getSalesByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: 'Completed',
          $or: [{ couponDiscount: { $gt: 0 } }, { 'flashSaleApplied.0': { $exists: true } }],
        },
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          count: { $sum: 1 },
          totalSalesAmount: { $sum: { $add: ['$couponDiscount', { $sum: '$flashSaleApplied.discount' }] } },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: 1,
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'year',
          },
        },
      },
      {
        $addFields: {
          count: { $ifNull: ['$count', 0] },
          totalSalesAmount: { $ifNull: ['$totalSalesAmount', 0] },
          year: { $year: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          count: 1,
          totalSalesAmount: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    return {
      message: 'Sales by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches sales discount total analytics by days for a given date range.
 */
const getSalesDiscountTotalByDays = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          totalDiscount: { $sum: { $add: ['$couponDiscount', { $sum: '$flashSaleApplied.discount' }] } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'day',
          },
        },
      },
      {
        $addFields: {
          totalDiscount: { $ifNull: ['$totalDiscount', 0] },
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          day: 1,
          totalDiscount: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, day: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.totalDiscount, 0);
    return {
      message: 'Sales discount total by days fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches sales discount total analytics by months for a given date range.
 */
const getSalesDiscountTotalByMonths = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          totalDiscount: { $sum: { $add: ['$couponDiscount', { $sum: '$flashSaleApplied.discount' }] } },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $densify: {
          field: 'date',
          range: {
            bounds: [from, to],
            step: 1,
            unit: 'month',
          },
        },
      },
      {
        $addFields: {
          totalDiscount: { $ifNull: ['$totalDiscount', 0] },
          count: { $ifNull: ['$count', 0] },
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          month: 1,
          totalDiscount: 1,
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    const total = result.reduce((sum, item) => sum + item.totalDiscount, 0);
    return {
      message: 'Sales discount total by months fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches sales discount total analytics by years for a given date range.
 */
const getSalesDiscountTotalByYears = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{ data: AnalyticsResult[]; total: number }> => {
  try {
    // Get the year range
    const fromYear = from.getFullYear();
    const toYear = to.getFullYear();

    // Generate all years in the range for MongoDB
    const allYears = [];
    for (let year = fromYear; year < toYear; year++) {
      allYears.push({ year });
    }

    const result = await Order.aggregate([
      // Create a facet to get both actual data and the complete year range
      {
        $facet: {
          // Get actual sales discount data
          actualData: [
            { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
            {
              $group: {
                _id: { year: { $year: '$createdAt' } },
                totalDiscount: { $sum: { $add: ['$couponDiscount', { $sum: '$flashSaleApplied.discount' }] } },
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                year: '$_id.year',
                totalDiscount: 1,
                count: 1,
              },
            },
          ],
          // Create the full year range
          allYears: [
            { $limit: 1 }, // We only need one document to work with
            { $project: { _id: 0 } },
            { $addFields: { years: allYears } },
            { $unwind: '$years' },
            { $replaceRoot: { newRoot: '$years' } },
            {
              $addFields: {
                totalDiscount: 0,
                count: 0,
              },
            },
          ],
        },
      },
      // Combine the results
      {
        $project: {
          combinedData: {
            $concatArrays: ['$actualData', '$allYears'],
          },
        },
      },
      { $unwind: '$combinedData' },
      { $replaceRoot: { newRoot: '$combinedData' } },
      // Group by year to merge actual data with zero defaults
      {
        $group: {
          _id: '$year',
          totalDiscount: { $max: '$totalDiscount' }, // Max will pick the actual value over 0
          count: { $max: '$count' },
        },
      },
      {
        $project: {
          _id: 0,
          year: '$_id',
          totalDiscount: 1,
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);

    const total = result.reduce((sum, item) => sum + item.totalDiscount, 0);
    return {
      message: 'Sales discount total by years fetched successfully',
      data: { data: result, total },
      code: 200,
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

export default {
  getSellerStatistics,
  getTotalSales,
  getChartData,
  getOrderVsReturns,
  getRangeCount,
  getPaginatedStatisticsDays,
  getPaginatedStatisticsWeeks,
  getPaginatedStatisticsMonths,
  getPaginatedStatisticsYears,
  getWishlistFrequencyByDays,
  getWishlistFrequencyByMonths,
  getWishlistFrequencyByYears,
  getOrdersByDays,
  getOrdersByMonths,
  getOrdersByYears,
  getOrderCancelledByDays,
  getOrderCancelledByMonths,
  getOrderCancelledByYears,
  getShipmentsDeliveredByDays,
  getShipmentsDeliveredByMonths,
  getShipmentsDeliveredByYears,
  getOrderReturnedByDays,
  getOrderReturnedByMonths,
  getOrderReturnedByYears,
  getOrderFailedByDays,
  getOrderFailedByMonths,
  getOrderFailedByYears,
  getShipmentsInWarehouseByDays,
  getShipmentsInWarehouseByMonths,
  getShipmentsInWarehouseByYears,
  getTransactionsByDays,
  getTransactionsByMonths,
  getTransactionsByYears,
  getTotalTransactionsByDays,
  getTotalTransactionsByMonths,
  getTotalTransactionsByYears,
  getUserJoiningRateByDays,
  getUserJoiningRateByMonths,
  getUserJoiningRateByYears,
  getCouponRedemptionByDays,
  getCouponRedemptionByMonths,
  getCouponRedemptionByYears,
  getReviewsByDays,
  getReviewsByMonths,
  getReviewsByYears,
  getReviewRateByDays,
  getReviewRateByMonths,
  getReviewRateByYears,
  getReviewMoodByDays,
  getReviewMoodByMonths,
  getReviewMoodByYears,
  getRevenueByDays,
  getRevenueByMonths,
  getRevenueByYears,
  getProductsAddedByDays,
  getProductsAddedByMonths,
  getProductsAddedByYears,
  getCurrentCartsByDays,
  getCurrentCartsByMonths,
  getCurrentCartsByYears,
  getSalesByDays,
  getSalesByMonths,
  getSalesByYears,
  getSalesDiscountTotalByDays,
  getSalesDiscountTotalByMonths,
  getSalesDiscountTotalByYears,
};
