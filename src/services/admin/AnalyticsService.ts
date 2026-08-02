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
import Coupon from '@/models/Coupon';
import mongoose from 'mongoose';
import { escapeRegex } from '@/helpers/regex';

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
 * Helper function to convert month number to short month name
 */
const getMonthName = (month: number): string => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return monthNames[month - 1] || 'Unknown';
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

// ============================================
// NEW ANALYTICS SERVICE METHODS
// ============================================

/**
 * Get sales overview with key metrics
 */
const getSalesOverview = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  comparisonPeriod: {
    revenue: number;
    orders: number;
    percentageChange: number;
  };
}> => {
  try {
    console.log('🔍 getSalesOverview - Date range:', { from, to });

    // Current period stats
    const currentStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const current = currentStats[0] || { totalRevenue: 0, totalOrders: 0 };
    const averageOrderValue = current.totalOrders > 0 ? current.totalRevenue / current.totalOrders : 0;

    // Previous period (same duration)
    const duration = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - duration);
    const previousTo = new Date(from.getTime() - 1);

    const previousStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: previousFrom, $lte: previousTo },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const previous = previousStats[0] || { totalRevenue: 0, totalOrders: 0 };
    const percentageChange =
      previous.totalRevenue > 0 ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 : 0;

    console.log('✅ getSalesOverview - Results:', {
      currentRevenue: current.totalRevenue,
      currentOrders: current.totalOrders,
      previousRevenue: previous.totalRevenue,
      previousOrders: previous.totalOrders,
    });

    return {
      message: 'Sales overview fetched successfully',
      data: {
        totalRevenue: current.totalRevenue,
        totalOrders: current.totalOrders,
        averageOrderValue,
        comparisonPeriod: {
          revenue: previous.totalRevenue,
          orders: previous.totalOrders,
          percentageChange,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getSalesOverview:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get orders overview with status breakdown
 */
const getOrdersOverview = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{
  totalOrders: number;
  pending: number;
  processing: number;
  completed: number;
  cancelled: number;
  failed: number;
  comparisonPeriod: {
    orders: number;
    percentageChange: number;
  };
}> => {
  try {
    const stats = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusMap: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
      failed: 0,
    };

    let totalOrders = 0;
    stats.forEach((item) => {
      const status = item._id?.toLowerCase() || 'pending';
      if (statusMap.hasOwnProperty(status)) {
        statusMap[status] = item.count;
      }
      totalOrders += item.count;
    });

    // Calculate comparison period (same duration, before 'from')
    const duration = to.getTime() - from.getTime();
    const comparisonFrom = new Date(from.getTime() - duration);
    const comparisonTo = from;

    const previousOrders = await Order.countDocuments({
      createdAt: { $gte: comparisonFrom, $lt: comparisonTo },
    });

    const percentageChange =
      previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : totalOrders > 0 ? 100 : 0;

    return {
      message: 'Orders overview fetched successfully',
      data: {
        totalOrders,
        pending: statusMap.pending,
        processing: statusMap.processing,
        completed: statusMap.completed,
        cancelled: statusMap.cancelled,
        failed: statusMap.failed,
        comparisonPeriod: {
          orders: previousOrders,
          percentageChange: Math.round(percentageChange * 100) / 100,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getOrdersOverview:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get transactions overview with status breakdown
 */
const getTransactionsOverview = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{
  totalTransactions: number;
  pending: number;
  completed: number;
  failed: number;
  totalAmount: number;
}> => {
  try {
    const stats = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]);

    let totalTransactions = 0;
    let totalAmount = 0;
    let pending = 0;
    let completed = 0;
    let failed = 0;

    stats.forEach((item) => {
      const status = item._id?.toLowerCase() || 'pending';
      const count = item.count || 0;
      const amount = item.amount || 0;

      totalTransactions += count;
      totalAmount += amount;

      // Group statuses for display
      if (status === 'pending') {
        pending += count;
      } else if (status === 'completed' || status === 'refunded' || status === 'partially_refunded') {
        // Count refunds as completed since they were successful transactions
        completed += count;
      } else if (status === 'failed' || status === 'cancelled') {
        // Group failed and cancelled together
        failed += count;
      }
    });

    return {
      message: 'Transactions overview fetched successfully',
      data: {
        totalTransactions,
        pending,
        completed,
        failed,
        totalAmount,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getTransactionsOverview:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get users overview with metrics
 */
const getUsersOverview = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  comparisonPeriod: {
    users: number;
    percentageChange: number;
  };
}> => {
  try {
    // Total users in system
    const totalUsers = await User.countDocuments();

    // New users in period
    const newUsers = await User.countDocuments({
      createdAt: { $gte: from, $lte: to },
    });

    // Active users (made order in period)
    const activeUserIds = await Order.distinct('userId', {
      createdAt: { $gte: from, $lte: to },
    });
    const activeUsers = activeUserIds.length;

    // Inactive users (total - active)
    const inactiveUsers = totalUsers - activeUsers;

    // Calculate comparison period (same duration, before 'from')
    const duration = to.getTime() - from.getTime();
    const comparisonFrom = new Date(from.getTime() - duration);
    const comparisonTo = from;

    const previousNewUsers = await User.countDocuments({
      createdAt: { $gte: comparisonFrom, $lt: comparisonTo },
    });

    const percentageChange =
      previousNewUsers > 0 ? ((newUsers - previousNewUsers) / previousNewUsers) * 100 : newUsers > 0 ? 100 : 0;

    return {
      message: 'Users overview fetched successfully',
      data: {
        totalUsers,
        newUsers,
        activeUsers,
        inactiveUsers,
        comparisonPeriod: {
          users: previousNewUsers,
          percentageChange: Math.round(percentageChange * 100) / 100,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getUsersOverview:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get products overview with stock status
 */
const getProductsOverview = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{
  totalProducts: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
}> => {
  try {
    const totalProducts = await Product.countDocuments();
    const outOfStock = await Product.countDocuments({ stock: { $lte: 0 } });

    // Low stock: products where stock > 0 but <= lowStockThreshold
    const lowStock = await Product.countDocuments({
      $expr: {
        $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }],
      },
    });

    // In stock: products where stock > lowStockThreshold
    const inStock = await Product.countDocuments({
      $expr: { $gt: ['$stock', '$lowStockThreshold'] },
    });

    return {
      message: 'Products overview fetched successfully',
      data: {
        totalProducts,
        inStock,
        outOfStock,
        lowStock,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getProductsOverview:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get reviews overview with rating analysis
 */
const getReviewsOverview = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{
  totalReviews: number;
  averageRating: number;
  positiveReviews: number;
  negativeReviews: number;
}> => {
  try {
    const stats = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          positive: {
            $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] },
          },
          negative: {
            $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] },
          },
          neutral: {
            $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalReviews: 0,
      averageRating: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
    };

    return {
      message: 'Reviews overview fetched successfully',
      data: {
        totalReviews: result.totalReviews,
        averageRating: result.averageRating,
        positiveReviews: result.positive,
        negativeReviews: result.negative,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getReviewsOverview:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get coupons overview
 */
const getCouponsOverview = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<{
  totalCoupons: number;
  activeCoupons: number;
  expiredCoupons: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
}> => {
  try {
    const now = new Date();
    const totalCoupons = await Coupon.countDocuments({ deleted: { $ne: true } });

    // Active coupons: active=true AND current date is between startDate and endDate
    const activeCoupons = await Coupon.countDocuments({
      active: true,
      deleted: { $ne: true },
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    // Expired coupons: endDate has passed
    const expiredCoupons = await Coupon.countDocuments({
      deleted: { $ne: true },
      endDate: { $lt: now },
    });

    const redemptionStats = await CouponRedemption.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          totalRedemptions: { $sum: 1 },
          totalDiscountGiven: { $sum: '$amountDiscounted' },
        },
      },
    ]);

    const redemptions = redemptionStats[0] || { totalRedemptions: 0, totalDiscountGiven: 0 };

    return {
      message: 'Coupons overview fetched successfully',
      data: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        totalRedemptions: redemptions.totalRedemptions,
        totalDiscountGiven: redemptions.totalDiscountGiven,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getCouponsOverview:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get revenue vs expense chart data
 */
const getRevenueExpenseChart = async ({
  from,
  to,
  groupBy = 'months',
}: {
  from: Date;
  to: Date;
  groupBy?: string;
}): CustomResponsePromise<Array<{ date: string; revenue: number; expense: number }>> => {
  try {
    // Group format based on groupBy parameter
    let groupFormat: any;

    if (groupBy === 'days') {
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
    } else if (groupBy === 'weeks') {
      groupFormat = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' },
      };
    } else if (groupBy === 'years') {
      groupFormat = {
        year: { $year: '$createdAt' },
      };
    } else {
      // Default to months
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
    }

    // Get revenue from completed orders
    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
      {
        $group: {
          _id: groupFormat,
          revenue: { $sum: '$total' },
          shippingCost: { $sum: '$shippingPrice' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } },
    ]);

    // Get refund amounts (expenses)
    const refunds = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $in: ['refunded', 'partially_refunded'] },
        },
      },
      {
        $group: {
          _id: groupFormat,
          refundAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Create a map for refunds
    const refundMap = new Map();
    refunds.forEach((item: any) => {
      const key = JSON.stringify(item._id);
      refundMap.set(key, item.refundAmount || 0);
    });

    // Format the data based on groupBy
    const chartData = result.map((item: any) => {
      let dateStr: string;
      const key = JSON.stringify(item._id);
      const refundAmount = refundMap.get(key) || 0;

      if (groupBy === 'days') {
        dateStr = new Date(item._id.year, item._id.month - 1, item._id.day).toISOString();
      } else if (groupBy === 'weeks') {
        // Calculate first day of week
        const firstDayOfYear = new Date(item._id.year, 0, 1);
        const daysToAdd = (item._id.week - 1) * 7;
        const weekDate = new Date(firstDayOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        dateStr = weekDate.toISOString();
      } else if (groupBy === 'years') {
        dateStr = new Date(item._id.year, 0, 1).toISOString();
      } else {
        // months
        dateStr = new Date(item._id.year, item._id.month - 1, 1).toISOString();
      }

      return {
        date: dateStr,
        revenue: item.revenue || 0,
        expense: (item.shippingCost || 0) + refundAmount,
      };
    });

    return {
      message: 'Revenue expense chart data fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getRevenueExpenseChart:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get profit/loss chart data with revenue, expenses, and returns
 */
const getProfitLossChart = async ({
  from,
  to,
  groupBy = 'months',
}: {
  from: Date;
  to: Date;
  groupBy?: string;
}): CustomResponsePromise<Array<{ date: string; revenue: number; expenses: number; returns: number }>> => {
  try {
    // Group format based on groupBy parameter
    let groupFormat: any;

    if (groupBy === 'days') {
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
    } else if (groupBy === 'weeks') {
      groupFormat = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' },
      };
    } else if (groupBy === 'years') {
      groupFormat = {
        year: { $year: '$createdAt' },
      };
    } else {
      // Default to months
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
    }

    // Get revenue from completed orders
    const revenueData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: 'Completed',
        },
      },
      {
        $group: {
          _id: groupFormat,
          revenue: { $sum: '$total' },
        },
      },
    ]);

    // Get expenses (shipping costs from all non-cancelled orders)
    const expenseData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
      {
        $group: {
          _id: groupFormat,
          shippingCosts: { $sum: '$shippingPrice' },
        },
      },
    ]);

    // Get returns/refunds
    const returnData = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $in: ['refunded', 'partially_refunded'] },
        },
      },
      {
        $group: {
          _id: groupFormat,
          returnAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Create maps for quick lookup
    const revenueMap = new Map();
    const expenseMap = new Map();
    const returnMap = new Map();

    revenueData.forEach((item: any) => {
      const key = JSON.stringify(item._id);
      revenueMap.set(key, item.revenue || 0);
    });

    expenseData.forEach((item: any) => {
      const key = JSON.stringify(item._id);
      expenseMap.set(key, item.shippingCosts || 0);
    });

    returnData.forEach((item: any) => {
      const key = JSON.stringify(item._id);
      returnMap.set(key, item.returnAmount || 0);
    });

    // Combine all unique date periods
    const allPeriods = new Set<string>();
    Array.from(revenueMap.keys()).forEach((key) => allPeriods.add(key));
    Array.from(expenseMap.keys()).forEach((key) => allPeriods.add(key));
    Array.from(returnMap.keys()).forEach((key) => allPeriods.add(key));

    // Format the data
    const chartData = Array.from(allPeriods).map((key) => {
      const period = JSON.parse(key);
      let dateStr: string;

      if (groupBy === 'days') {
        dateStr = new Date(period.year, period.month - 1, period.day).toISOString();
      } else if (groupBy === 'weeks') {
        const firstDayOfYear = new Date(period.year, 0, 1);
        const daysToAdd = (period.week - 1) * 7;
        const weekDate = new Date(firstDayOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        dateStr = weekDate.toISOString();
      } else if (groupBy === 'years') {
        dateStr = new Date(period.year, 0, 1).toISOString();
      } else {
        // months
        dateStr = new Date(period.year, period.month - 1, 1).toISOString();
      }

      const revenue = revenueMap.get(key) || 0;
      const expenses = expenseMap.get(key) || 0;
      const returns = returnMap.get(key) || 0;

      return {
        date: dateStr,
        revenue,
        expenses,
        returns,
      };
    });

    // Sort by date
    chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      message: 'Profit/loss chart data fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getProfitLossChart:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get orders trend chart data
 */
const getOrdersTrend = async ({
  from,
  to,
  groupBy = 'months',
}: {
  from: Date;
  to: Date;
  groupBy?: string;
}): CustomResponsePromise<Array<{ date: string; count: number }>> => {
  try {
    // Group format based on groupBy parameter
    let groupFormat: any;

    if (groupBy === 'days') {
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
    } else if (groupBy === 'years') {
      groupFormat = {
        year: { $year: '$createdAt' },
      };
    } else {
      // Default to months
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
    }

    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: groupFormat,
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Format the data based on groupBy
    const chartData = result.map((item: any) => {
      let dateStr: string;

      if (groupBy === 'days') {
        dateStr = new Date(item._id.year, item._id.month - 1, item._id.day).toISOString();
      } else if (groupBy === 'years') {
        dateStr = new Date(item._id.year, 0, 1).toISOString();
      } else {
        // months
        dateStr = new Date(item._id.year, item._id.month - 1, 1).toISOString();
      }

      return {
        date: dateStr,
        count: item.count,
      };
    });

    return {
      message: 'Orders trend data fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getOrdersTrend:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get transactions trend chart data
 */
const getTransactionsTrend = async ({
  from,
  to,
  groupBy = 'months',
}: {
  from: Date;
  to: Date;
  groupBy?: string;
}): CustomResponsePromise<Array<{ date: string; count: number }>> => {
  try {
    // Group format based on groupBy parameter
    let groupFormat: any;

    if (groupBy === 'days') {
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
    } else if (groupBy === 'years') {
      groupFormat = {
        year: { $year: '$createdAt' },
      };
    } else {
      // Default to months
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
    }

    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: groupFormat,
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Format the data based on groupBy
    const chartData = result.map((item: any) => {
      let dateStr: string;

      if (groupBy === 'days') {
        dateStr = new Date(item._id.year, item._id.month - 1, item._id.day).toISOString();
      } else if (groupBy === 'years') {
        dateStr = new Date(item._id.year, 0, 1).toISOString();
      } else {
        // months
        dateStr = new Date(item._id.year, item._id.month - 1, 1).toISOString();
      }

      return {
        date: dateStr,
        count: item.count,
      };
    });

    return {
      message: 'Transactions trend data fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getTransactionsTrend:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get customer acquisition chart data
 */
const getCustomerAcquisition = async ({
  from,
  to,
  groupBy = 'months',
}: {
  from: Date;
  to: Date;
  groupBy?: string;
}): CustomResponsePromise<Array<{ date: string; count: number }>> => {
  try {
    // Group format based on groupBy parameter
    let groupFormat: any;

    if (groupBy === 'days') {
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
    } else if (groupBy === 'years') {
      groupFormat = {
        year: { $year: '$createdAt' },
      };
    } else {
      // Default to months
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
    }

    // Get new users grouped by time period
    const newUsers = await User.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: groupFormat,
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Format the data based on groupBy
    const chartData = newUsers.map((item: any) => {
      let dateStr: string;

      if (groupBy === 'days') {
        dateStr = new Date(item._id.year, item._id.month - 1, item._id.day).toISOString();
      } else if (groupBy === 'years') {
        dateStr = new Date(item._id.year, 0, 1).toISOString();
      } else {
        // months
        dateStr = new Date(item._id.year, item._id.month - 1, 1).toISOString();
      }

      return {
        date: dateStr,
        count: item.count,
      };
    });

    return {
      message: 'Customer acquisition data fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getCustomerAcquisition:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get order status distribution for pie chart
 */
const getOrderStatusDistribution = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<Array<{ status: string; count: number }>> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const chartData = result.map((item: any) => ({
      status: item._id || 'Unknown',
      count: item.count || 0,
    }));

    return {
      message: 'Order status distribution fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getOrderStatusDistribution:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get transaction status distribution for pie chart
 */
const getTransactionStatusDistribution = async ({
  from,
  to,
  groupBy = 'months',
}: {
  from: Date;
  to: Date;
  groupBy?: string;
}): CustomResponsePromise<Array<{ date: string; [key: string]: any }>> => {
  try {
    // Group format based on groupBy parameter
    let groupFormat: any;

    if (groupBy === 'days') {
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
    } else if (groupBy === 'years') {
      groupFormat = {
        year: { $year: '$createdAt' },
      };
    } else {
      // Default to months
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
    }

    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            ...groupFormat,
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Transform data into time-series format with status columns
    const dataMap = new Map<string, any>();

    result.forEach((item: any) => {
      let dateStr: string;

      if (groupBy === 'days') {
        dateStr = new Date(item._id.year, item._id.month - 1, item._id.day).toISOString();
      } else if (groupBy === 'years') {
        dateStr = new Date(item._id.year, 0, 1).toISOString();
      } else {
        // months
        dateStr = new Date(item._id.year, item._id.month - 1, 1).toISOString();
      }

      if (!dataMap.has(dateStr)) {
        dataMap.set(dateStr, {
          date: dateStr,
          pending: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          refunded: 0,
          partially_refunded: 0,
        });
      }

      const status = item._id.status || 'pending';
      const entry = dataMap.get(dateStr);
      entry[status] = item.count;
    });

    const chartData = Array.from(dataMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return {
      message: 'Transaction status distribution fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getTransactionStatusDistribution:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get rating distribution for pie chart
 */
const getRatingDistribution = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<Array<{ rating: number; count: number }>> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const chartData = result.map((item: any) => ({
      rating: item._id,
      count: item.count || 0,
    }));

    return {
      message: 'Rating distribution fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getRatingDistribution:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get review sentiment over time
 */
const getReviewSentiment = async ({
  from,
  to,
  groupBy = 'months',
}: {
  from: Date;
  to: Date;
  groupBy?: string;
}): CustomResponsePromise<Array<{ month: string; positive: number; negative: number; neutral: number }>> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          positive: {
            $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] },
          },
          negative: {
            $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] },
          },
          neutral: {
            $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const chartData = result.map((item: any) => ({
      month: getMonthName(item._id.month),
      positive: item.positive || 0,
      negative: item.negative || 0,
      neutral: item.neutral || 0,
    }));

    return {
      message: 'Review sentiment data fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getReviewSentiment:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get coupon redemption trend (from orders.couponSnapshot, only successful orders)
 */
const getCouponRedemptionTrend = async ({
  from,
  to,
  groupBy = 'days',
}: {
  from: Date;
  to: Date;
  groupBy?: string;
}): CustomResponsePromise<Array<{ date: string; count: number }>> => {
  try {
    // Group format based on groupBy parameter
    let groupFormat: any;

    if (groupBy === 'days') {
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
    } else if (groupBy === 'years') {
      groupFormat = {
        year: { $year: '$createdAt' },
      };
    } else {
      // Default to months
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
    }

    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          couponSnapshot: { $ne: null },
          $or: [{ status: 'Completed' }, { isPaid: true }],
        },
      },
      {
        $group: {
          _id: groupFormat,
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Format the data based on groupBy
    const chartData = result.map((item: any) => {
      let dateStr: string;

      if (groupBy === 'days') {
        dateStr = new Date(item._id.year, item._id.month - 1, item._id.day).toISOString();
      } else if (groupBy === 'years') {
        dateStr = new Date(item._id.year, 0, 1).toISOString();
      } else {
        // months
        dateStr = new Date(item._id.year, item._id.month - 1, 1).toISOString();
      }

      return {
        date: dateStr,
        count: item.count,
      };
    });

    return {
      message: 'Coupon redemption trend fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getCouponRedemptionTrend:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get payment methods distribution
 */
const getPaymentMethods = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<Array<{ name: string; value: number }>> => {
  try {
    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$paymentMethod',
          value: { $sum: 1 },
        },
      },
    ]);

    const chartData = result.map((item: any) => ({
      name: item._id || 'Unknown',
      value: item.value || 0,
    }));

    return {
      message: 'Payment methods distribution fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getPaymentMethods:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

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
 * Get user demographics (for world map)
 */
const getUserDemographics = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<Array<{ country: string; count: number }>> => {
  try {
    const result = await User.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$country',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const chartData = result.map((item: any) => ({
      country: item._id || 'Unknown',
      count: item.count || 0,
    }));

    return {
      message: 'User demographics fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getUserDemographics:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get coupon type distribution
 */
const getCouponTypeDistribution = async ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): CustomResponsePromise<Array<{ type: string; count: number }>> => {
  try {
    const result = await Coupon.aggregate([
      { $match: { deleted: { $ne: true } } }, // Only count non-deleted coupons
      {
        $group: {
          _id: '$discountType',
          count: { $sum: 1 },
        },
      },
    ]);

    const chartData = result.map((item: any) => ({
      type: item._id, // Keep as 'percentage' or 'fixed' - frontend will format it
      count: item.count || 0,
    }));

    return {
      message: 'Coupon type distribution fetched successfully',
      data: chartData,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getCouponTypeDistribution:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

// Table endpoint service methods

/**
 * Get sales by category (paginated table)
 */
const getSalesByCategory = async ({
  from,
  to,
  page = 1,
  limit = 10,
  sortBy = 'totalRevenue',
  sortOrder = 'desc',
}: {
  from: Date;
  to: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}): CustomResponsePromise<{
  data: Array<{ category: string; totalRevenue: number; totalOrders: number; averageOrderValue: number }>;
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    console.log('🔍 getSalesByCategory - Date range:', { from, to, page, limit });

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Step 1: Count matching orders
    const matchingOrders = await Order.countDocuments({
      createdAt: { $gte: from, $lte: to },
      status: { $nin: ['Cancelled', 'Failed'] },
    });
    console.log('📊 Step 1: Matching orders:', matchingOrders);

    // Step 2: Check items after unwind
    const afterUnwind = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
      { $unwind: '$products' },
      { $count: 'total' },
    ]);
    console.log('📊 Step 2: Items after unwind:', afterUnwind[0]?.total || 0);

    // Step 3: Check after product lookup
    const afterProductLookup = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
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
        $facet: {
          withProduct: [{ $match: { product: { $exists: true, $ne: null } } }, { $count: 'total' }],
          withoutProduct: [{ $match: { product: null } }, { $count: 'total' }],
        },
      },
    ]);
    console.log('📊 Step 3: After product lookup:', {
      withProduct: afterProductLookup[0]?.withProduct[0]?.total || 0,
      withoutProduct: afterProductLookup[0]?.withoutProduct[0]?.total || 0,
    });

    // Step 4: Check after category lookup
    const afterCategoryLookup = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
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
        $facet: {
          withCategory: [{ $match: { category: { $exists: true, $ne: null } } }, { $count: 'total' }],
          withoutCategory: [{ $match: { category: null } }, { $count: 'total' }],
        },
      },
    ]);

    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
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
      // Only filter out if product or category is completely missing
      {
        $match: {
          product: { $exists: true, $ne: null },
          category: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { orderId: '$_id', categoryId: '$category._id' },
          categoryName: { $first: '$category.name' },
          orderRevenue: { $sum: { $multiply: ['$products.price', '$products.qty'] } },
        },
      },
      {
        $group: {
          _id: '$_id.categoryId',
          categoryName: { $first: '$categoryName' },
          totalRevenue: { $sum: '$orderRevenue' },
          totalOrders: { $sum: 1 },
        },
      },
      {
        $project: {
          category: '$categoryName',
          totalRevenue: 1,
          totalOrders: 1,
          averageOrderValue: { $divide: ['$totalRevenue', '$totalOrders'] },
        },
      },
      { $sort: { [sortBy]: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalResult = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
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
      // Only filter out if product or category is completely missing
      {
        $match: {
          product: { $exists: true, $ne: null },
          category: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { orderId: '$_id', categoryId: '$category._id' },
        },
      },
      {
        $group: {
          _id: '$_id.categoryId',
        },
      },
      { $count: 'total' },
    ]);

    const totalRecords = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: 'Sales by category fetched successfully',
      data: {
        data: result,
        pagination: { currentPage: page, totalPages, totalRecords },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getSalesByCategory:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get top selling products
 */
const getTopSellingProducts = async ({
  from,
  to,
  limit = 10,
}: {
  from: Date;
  to: Date;
  limit?: number;
}): CustomResponsePromise<Array<{ productName: string; unitsSold: number; revenue: number }>> => {
  try {
    const result = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product',
          unitsSold: { $sum: '$products.qty' },
          revenue: { $sum: { $multiply: ['$products.price', '$products.qty'] } },
        },
      },
      { $sort: { unitsSold: -1 } },
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
      {
        $project: {
          productName: '$product.name',
          unitsSold: 1,
          revenue: 1,
        },
      },
    ]);

    return {
      message: 'Top selling products fetched successfully',
      data: result,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getTopSellingProducts:', error);
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
 * Get top customers by total spend
 */
const getTopCustomers = async ({
  from,
  to,
  page = 1,
  limit = 10,
}: {
  from: Date;
  to: Date;
  page?: number;
  limit?: number;
}): CustomResponsePromise<{
  data: Array<{
    customerId: string;
    customerName: string;
    customerEmail: string;
    totalSpent: number;
    orderCount: number;
  }>;
  pagination: { currentPage: number; totalPages: number; totalRecords: number };
}> => {
  try {
    const skip = (page - 1) * limit;

    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: '$total' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          customerId: '$_id',
          customerName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          customerEmail: '$user.email',
          totalSpent: 1,
          orderCount: 1,
        },
      },
    ]);

    const totalResult = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['Cancelled', 'Failed'] },
        },
      },
      { $group: { _id: '$userId' } },
      { $count: 'total' },
    ]);

    const totalRecords = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: 'Top customers fetched successfully',
      data: {
        data: result,
        pagination: { currentPage: page, totalPages, totalRecords },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getTopCustomers:', error);
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

/**
 * Get top coupons by redemption count (from orders.couponSnapshot, only successful orders)
 */
const getTopCoupons = async ({
  from,
  to,
  page = 1,
  limit = 10,
}: {
  from: Date;
  to: Date;
  page?: number;
  limit?: number;
}): CustomResponsePromise<{
  data: Array<{
    code: string;
    type: string;
    discount: number;
    redemptions: number;
    totalDiscount: number;
    status: string;
  }>;
  pagination: { currentPage: number; totalPages: number; totalRecords: number; limit: number };
}> => {
  try {
    const skip = (page - 1) * limit;

    const matchStage = {
      createdAt: { $gte: from, $lte: to },
      couponCode: { $ne: null },
      couponSnapshot: { $ne: null },
      isPaid: true,
      status: { $nin: ['Cancelled', 'Failed'] },
    };

    const result = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$couponCode',
          redemptions: { $sum: 1 },
          totalDiscount: { $sum: '$couponDiscount' },
        },
      },
      { $sort: { redemptions: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'coupons',
          localField: '_id',
          foreignField: 'coupon',
          as: 'couponData',
        },
      },
      { $unwind: { path: '$couponData', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          code: '$_id',
          type: '$couponData.couponType',
          discount: '$couponData.discount',
          redemptions: 1,
          totalDiscount: 1,
          status: {
            $cond: [
              { $and: [{ $eq: ['$couponData.active', true] }, { $eq: ['$couponData.deleted', false] }] },
              'Active',
              'Inactive',
            ],
          },
        },
      },
    ]);

    const totalResult = await Order.aggregate([
      { $match: matchStage },
      { $group: { _id: '$couponCode' } },
      { $count: 'total' },
    ]);

    const totalRecords = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: 'Top coupons fetched successfully',
      data: {
        data: result,
        pagination: { currentPage: page, totalPages, totalRecords, limit },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getTopCoupons:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get most wishlisted products
 */
const getMostWishlistedProducts = async ({
  from,
  to,
  limit = 10,
}: {
  from: Date;
  to: Date;
  limit?: number;
}): CustomResponsePromise<
  Array<{ productId: string; productName: string; coverImage: string | null; wishlistCount: number }>
> => {
  try {
    const result = await Wishlist.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$product',
          wishlistCount: { $sum: 1 },
        },
      },
      { $sort: { wishlistCount: -1 } },
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
      {
        $match: {
          'product.name': { $exists: true, $ne: null },
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
          wishlistCount: 1,
        },
      },
    ]);

    return {
      message: 'Most wishlisted products fetched successfully',
      data: result,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getMostWishlistedProducts:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get most reviewed products
 */
const getMostReviewedProducts = async ({
  from,
  to,
  limit = 10,
}: {
  from: Date;
  to: Date;
  limit?: number;
}): CustomResponsePromise<
  Array<{
    productId: string;
    productName: string;
    coverImage: string | null;
    reviewCount: number;
    averageRating: number;
  }>
> => {
  try {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$product',
          reviewCount: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
      { $sort: { reviewCount: -1 } },
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
      {
        $match: {
          'product.name': { $exists: true, $ne: null },
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
          reviewCount: 1,
          averageRating: 1,
        },
      },
    ]);

    return {
      message: 'Most reviewed products fetched successfully',
      data: result,
      code: 200,
    };
  } catch (error) {
    console.error('Error in getMostReviewedProducts:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Get low stock products for stock report
 */
const getLowStockProducts = async ({
  page = 1,
  limit = 10,
}: {
  page?: number;
  limit?: number;
}): CustomResponsePromise<{
  products: Array<{
    productId: string;
    name: string;
    sku: number;
    stock: number;
    lowStockThreshold: number;
    category: string;
    coverImage: string | null;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> => {
  try {
    const skip = (page - 1) * limit;

    // Get total count
    const total = await Product.countDocuments({
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    });

    // Get low stock products
    const products = await Product.aggregate([
      {
        $match: {
          $expr: { $lte: ['$stock', '$lowStockThreshold'] },
        },
      },
      { $sort: { stock: 1 } }, // Sort by stock ascending (lowest first)
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData',
        },
      },
      { $unwind: { path: '$categoryData', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: '$_id',
          name: 1,
          sku: 1,
          stock: 1,
          lowStockThreshold: 1,
          category: '$categoryData.name',
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
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      message: 'Low stock products fetched successfully',
      data: {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getLowStockProducts:', error);
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
  // New analytics endpoints
  getSalesOverview,
  getOrdersOverview,
  getTransactionsOverview,
  getUsersOverview,
  getProductsOverview,
  getReviewsOverview,
  getCouponsOverview,
  getRevenueExpenseChart,
  getProfitLossChart,
  getOrdersTrend,
  getTransactionsTrend,
  getCustomerAcquisition,
  getOrderStatusDistribution,
  getTransactionStatusDistribution,
  getRatingDistribution,
  getReviewSentiment,
  getCouponRedemptionTrend,
  getPaymentMethods,
  getTopProductsRevenue,
  getCategoriesPerformance,
  getUserDemographics,
  getCouponTypeDistribution,
  getSalesByCategory,
  getTopSellingProducts,
  getOrdersTable,
  getTransactionsTable,
  getTopCustomers,
  getProductPerformance,
  getReviewsTable,
  getTopCoupons,
  getMostWishlistedProducts,
  getMostReviewedProducts,
  getLowStockProducts,
};
