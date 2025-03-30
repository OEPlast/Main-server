import Order from '@/models/Order';
import User from '@/models/User';

/**
 * Fetches the total number of orders.
 */
const getTotalAmount = async () => {
  try {
    const totalAmount = await Order.countDocuments();
    return totalAmount;
  } catch (error) {
    console.error('Error fetching total amount:', error);
    throw new Error('Failed to fetch total amount');
  }
};

/**
 * Fetches the total revenue from completed orders.
 */
const getTotalRevenue = async () => {
  try {
    const totalRevenue = await Order.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    return totalRevenue[0]?.total || 0;
  } catch (error) {
    console.error('Error fetching total revenue:', error);
    throw new Error('Failed to fetch total revenue');
  }
};

/**
 * Fetches the total number of unique customers.
 */
const getTotalCustomers = async () => {
  try {
    const totalCustomers = await User.countDocuments();
    return totalCustomers;
  } catch (error) {
    console.error('Error fetching total customers:', error);
    throw new Error('Failed to fetch total customers');
  }
};

/**
 * Fetches seller statistics (revenue and profit) for the last x days.
 */
const getSellerStatistics = async (days: number) => {
  try {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const stats = await Order.aggregate([
      { $match: { createdAt: { $gte: dateThreshold }, status: 'Completed' } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$total' },
          profit: { $sum: { $subtract: ['$total', '$totalBeforeDiscount'] } },
        },
      },
    ]);

    return stats[0] || { revenue: 0, profit: 0 };
  } catch (error) {
    console.error('Error fetching seller statistics:', error);
    throw new Error('Failed to fetch seller statistics');
  }
};

/**
 * Fetches total sales (revenue and profit) for the last x days.
 */
const getTotalSales = async (days: number) => {
  try {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const sales = await Order.aggregate([
      { $match: { createdAt: { $gte: dateThreshold }, status: 'Completed' } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$total' },
          profit: { $sum: { $subtract: ['$total', '$totalBeforeDiscount'] } },
        },
      },
    ]);

    return sales[0] || { revenue: 0, profit: 0 };
  } catch (error) {
    console.error('Error fetching total sales:', error);
    throw new Error('Failed to fetch total sales');
  }
};

/**
 * Fetches aggregated sale/purchase return data.
 */
const getSalePurchaseReturn = async () => {
  try {
    const returns = await Order.aggregate([
      { $match: { deliveryStatus: 'Returned' } },
      { $group: { _id: null, totalReturns: { $sum: '$total' } } },
    ]);
    return returns[0]?.totalReturns || 0;
  } catch (error) {
    console.error('Error fetching sale/purchase return data:', error);
    throw new Error('Failed to fetch sale/purchase return data');
  }
};

/**
 * Fetches the transfer history (recent completed orders).
 */
const getOrderHistory = async (limit: number) => {
  try {
    const transfers = await Order.find({ status: 'Completed' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id user createdAt total')
      .populate('user', 'name');

    return transfers;
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    throw new Error('Failed to fetch transfer history');
  }
};

/**
 * Fetches the return history (recent returned orders).
 */
const getReturnHistory = async (limit: number) => {
  try {
    const returns = await Order.find({ deliveryStatus: 'Returned' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id user createdAt total')
      .populate('user', 'name');

    return returns;
  } catch (error) {
    console.error('Error fetching return history:', error);
    throw new Error('Failed to fetch return history');
  }
};

export default {
  getTotalAmount,
  getTotalRevenue,
  getTotalCustomers,
  getSellerStatistics,
  getTotalSales,
  getSalePurchaseReturn,
  getOrderHistory,
  getReturnHistory,
};
