import Statistics, { StatisticsType } from '@/models/Statistics';
import { CustomResponsePromise } from '@/types';

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
          _id: null,
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

const Admin_AnalyticsService = {
  getSellerStatistics,
  getTotalSales,
  getChartData,
  getOrderVsReturns,
  getRangeCount,
  getPaginatedStatisticsDays,
  getPaginatedStatisticsWeeks,
  getPaginatedStatisticsMonths,
  getPaginatedStatisticsYears,
};

export default Admin_AnalyticsService;
