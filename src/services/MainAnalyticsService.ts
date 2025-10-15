import mongoose from 'mongoose';
import { logger } from '@/lib/logger';
import StatisticsService, { StatisticsType } from '@/models/Statistics';
import Order from '@/models/Order';
import Transaction from '@/models/Transaction';
import Shipment from '@/models/Shipment';
import User from '@/models/User';
import Wishlist from '@/models/wishlist';
import Review from '@/models/Review';
import CouponRedemption from '@/models/CouponRedemption';
import Cart from '@/models/Cart';
import Product from '@/models/Product';

/**
 * Increments a specific field in the Statistics model within a session transaction.
 * @param field - The field to increment.
 * @param incrementBy - The value to increment by.
 * @param timeStamp - Optional timestamp for the analytics event. Defaults to current time.
 * @returns Promise resolving to the updated Statistics document.
 */
const incrementAnalyticalField = async (
  field: Exclude<keyof StatisticsType, 'createdAt' | 'updatedAt' | 'date'>,
  incrementBy: number,
  timeStamp?: Date
): Promise<StatisticsType> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const currentTime = timeStamp || new Date();
    const startOfDay = new Date(
      Date.UTC(currentTime.getUTCFullYear(), currentTime.getUTCMonth(), currentTime.getUTCDate())
    );

    const Statistics = await StatisticsService.findOneAndUpdate(
      { date: startOfDay },
      { $inc: { [field]: incrementBy } },
      { new: true, upsert: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    return Statistics;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(`Error incrementing field ${field}:`, error);
    throw new Error(`Failed to increment field ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Service for tracking analytics events across the application.
 * This service is designed to work independently and will be moved to another server later.
 */
class AnalyticsService {
  // Order analytics methods
  /**
   * Tracks a successful order placement.
   * @param orderId - The ID of the order.
   * @param amount - The total amount of the order.
   */
  static async trackOrderPlaced(orderId: string, amount: number): Promise<void> {
    try {
      // Increment order count and revenue
      await incrementAnalyticalField('totalOrders', 1);
      await incrementAnalyticalField('totalAmount', amount);
      await incrementAnalyticalField('totalRevenue', amount);
      logger.info(`Analytics: Order placed - ID: ${orderId}, Amount: ${amount}`);
    } catch (error) {
      logger.error(`Analytics error tracking order placed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Tracks a successful order completion.
   * @param orderId - The ID of the order.
   * @param amount - The total amount of the order.
   */
  static async trackOrderCompleted(orderId: string, amount: number): Promise<void> {
    try {
      // Increment sales count
      await incrementAnalyticalField('totalSales', 1);
      logger.info(`Analytics: Order completed - ID: ${orderId}, Amount: ${amount}`);
    } catch (error) {
      logger.error(
        `Analytics error tracking order completion: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Tracks a returned order.
   * @param orderId - The ID of the order.
   */
  static async trackOrderReturned(orderId: string): Promise<void> {
    try {
      await incrementAnalyticalField('totalReturns', 1);
      logger.info(`Analytics: Order returned - ID: ${orderId}`);
    } catch (error) {
      logger.error(`Analytics error tracking order return: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // User analytics methods
  /**
   * Tracks a new customer registration.
   * @param userId - The ID of the new customer.
   */
  static async trackNewCustomer(userId: string): Promise<void> {
    try {
      await incrementAnalyticalField('totalCustomers', 1);
      logger.info(`Analytics: New customer registered - ID: ${userId}`);
    } catch (error) {
      logger.error(`Analytics error tracking new customer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Cart analytics methods
  /**
   * Tracks an item added to cart.
   * @param userId - The ID of the user.
   * @param productId - The ID of the product.
   * @param amount - The amount of the item (price * quantity).
   */
  static async trackItemAddedToCart(userId: string, productId: string, amount: number): Promise<void> {
    try {
      // Log cart activity for future analytics expansions
      logger.info(`Analytics: Item added to cart - User: ${userId}, Product: ${productId}, Amount: ${amount}`);
    } catch (error) {
      logger.error(
        `Analytics error tracking item added to cart: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Wishlist analytics methods
  /**
   * Tracks an item added to wishlist.
   * @param userId - The ID of the user.
   * @param productId - The ID of the product.
   */
  static async trackItemAddedToWishlist(userId: string, productId: string): Promise<void> {
    try {
      // Log wishlist activity for future analytics expansions
      logger.info(`Analytics: Item added to wishlist - User: ${userId}, Product: ${productId}`);
    } catch (error) {
      logger.error(
        `Analytics error tracking item added to wishlist: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Product analytics methods
  /**
   * Tracks a product view.
   * @param productId - The ID of the product.
   * @param userId - Optional user ID if user is logged in.
   */
  static async trackProductView(productId: string, userId?: string): Promise<void> {
    try {
      // Log product view for future analytics expansions
      logger.info(`Analytics: Product viewed - Product: ${productId}${userId ? `, User: ${userId}` : ''}`);
    } catch (error) {
      logger.error(`Analytics error tracking product view: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Review analytics methods
  /**
   * Tracks a review creation.
   * @param reviewId - The ID of the review.
   * @param productId - The ID of the product.
   * @param userId - The ID of the user.
   */
  static async trackReviewCreated(reviewId: string, productId: string, userId: string): Promise<void> {
    try {
      // Log review activity for future analytics expansions
      logger.info(`Analytics: Review created - Review: ${reviewId}, Product: ${productId}, User: ${userId}`);
    } catch (error) {
      logger.error(
        `Analytics error tracking review created: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Coupon analytics methods
  /**
   * Tracks a coupon usage.
   * @param couponId - The ID of the coupon.
   * @param userId - The ID of the user.
   * @param discountAmount - The discount amount.
   */
  static async trackCouponUsed(couponId: string, userId: string): Promise<void> {
    try {
      // Log coupon usage for future analytics expansions
      logger.info(`Analytics: Coupon used - Coupon: ${couponId}, User: ${userId}`);
    } catch (error) {
      logger.error(`Analytics error tracking coupon used: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets analytics data for a specific date range.
   * @param startDate - The start date for the analytics data.
   * @param endDate - The end date for the analytics data.
   * @returns Promise resolving to the analytics data.
   */
  static async getAnalytics(startDate: Date, endDate: Date) {
    try {
      return await StatisticsService.find({
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 });
    } catch (error) {
      logger.error(
        `Analytics error retrieving analytics data: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  // Wishlist frequency analytics
  static async getWishlistFrequencyByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getWishlistFrequencyByMonths(from: Date, to: Date) {
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
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getWishlistFrequencyByYears(from: Date, to: Date) {
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
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Order analytics
  static async getOrdersByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getOrdersByMonths(from: Date, to: Date) {
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
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getOrdersByYears(from: Date, to: Date) {
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
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Order cancelled analytics
  static async getOrderCancelledByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getOrderCancelledByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getOrderCancelledByYears(from: Date, to: Date) {
    try {
      const result = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Cancelled' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Order returned analytics
  static async getOrderReturnedByDays(from: Date, to: Date) {
    try {
      const result = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } }, // Assuming returned orders are marked as Completed but with return flag, adjust as needed
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getOrderReturnedByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getOrderReturnedByYears(from: Date, to: Date) {
    try {
      const result = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Order failed analytics
  static async getOrderFailedByDays(from: Date, to: Date) {
    try {
      const result = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Pending' } }, // Assuming failed orders are still Pending, adjust as needed
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getOrderFailedByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getOrderFailedByYears(from: Date, to: Date) {
    try {
      const result = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Pending' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Shipments Delivered analytics
  static async getShipmentsDeliveredByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getShipmentsDeliveredByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getShipmentsDeliveredByYears(from: Date, to: Date) {
    try {
      const result = await Shipment.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Delivered' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Shipments In-Warehouse analytics
  static async getShipmentsInWarehouseByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getShipmentsInWarehouseByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getShipmentsInWarehouseByYears(from: Date, to: Date) {
    try {
      const result = await Shipment.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'In-Warehouse' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Transactions analytics
  static async getTransactionsByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalAmount = result.reduce((sum, item) => sum + item.totalAmount, 0);
      return { data: result, total, totalAmount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getTransactionsByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalAmount = result.reduce((sum, item) => sum + item.totalAmount, 0);
      return { data: result, total, totalAmount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getTransactionsByYears(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalAmount = result.reduce((sum, item) => sum + item.totalAmount, 0);
      return { data: result, total, totalAmount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Total transactions made analytics
  static async getTotalTransactionsByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalAmount = result.reduce((sum, item) => sum + item.totalAmount, 0);
      return { data: result, total, totalAmount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getTotalTransactionsByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalAmount = result.reduce((sum, item) => sum + item.totalAmount, 0);
      return { data: result, total, totalAmount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getTotalTransactionsByYears(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalAmount = result.reduce((sum, item) => sum + item.totalAmount, 0);
      return { data: result, total, totalAmount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // User joining rate analytics
  static async getUserJoiningRateByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getUserJoiningRateByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getUserJoiningRateByYears(from: Date, to: Date) {
    try {
      const result = await User.aggregate([
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
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Coupon Redemption analytics
  static async getCouponRedemptionByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalDiscount = result.reduce((sum, item) => sum + item.totalDiscount, 0);
      return { data: result, total, totalDiscount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getCouponRedemptionByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalDiscount = result.reduce((sum, item) => sum + item.totalDiscount, 0);
      return { data: result, total, totalDiscount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getCouponRedemptionByYears(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalDiscount = result.reduce((sum, item) => sum + item.totalDiscount, 0);
      return { data: result, total, totalDiscount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Reviews analytics
  static async getReviewsByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getReviewsByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getReviewsByYears(from: Date, to: Date) {
    try {
      const result = await Review.aggregate([
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
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Review Rate analytics (average rating)
  static async getReviewRateByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getReviewRateByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getReviewRateByYears(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Review mood analytics (group by rating)
  static async getReviewMoodByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.rating': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getReviewMoodByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.rating': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getReviewMoodByYears(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.rating': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Revenue analytics
  static async getRevenueByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalRevenue = result.reduce((sum, item) => sum + item.totalRevenue, 0);
      return { data: result, total, totalRevenue };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getRevenueByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalRevenue = result.reduce((sum, item) => sum + item.totalRevenue, 0);
      return { data: result, total, totalRevenue };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getRevenueByYears(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalRevenue = result.reduce((sum, item) => sum + item.totalRevenue, 0);
      return { data: result, total, totalRevenue };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Revenue vs Returns analytics
  static async getRevenueVsReturnsByDays(from: Date, to: Date) {
    try {
      const revenueResult = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            revenue: { $sum: '$total' },
          },
        },
      ]);

      const returnsResult = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } }, // Assuming returns are marked as Completed, adjust if needed
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            returns: { $sum: 1 }, // Count of returns
          },
        },
      ]);

      // Merge results
      const merged: Record<string, { year: number; month: number; day: number; revenue: number; returns: number }> = {};
      revenueResult.forEach((item) => {
        const key = `${item._id.year}-${item._id.month}-${item._id.day}`;
        merged[key] = { ...item._id, revenue: item.revenue, returns: 0 };
      });
      returnsResult.forEach((item) => {
        const key = `${item._id.year}-${item._id.month}-${item._id.day}`;
        if (merged[key]) {
          merged[key].returns = item.returns;
        } else {
          merged[key] = { ...item._id, revenue: 0, returns: item.returns };
        }
      });

      const data = Object.values(merged).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
      });

      const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
      const totalReturns = data.reduce((sum, item) => sum + item.returns, 0);

      return { data, totalRevenue, totalReturns };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getRevenueVsReturnsByMonths(from: Date, to: Date) {
    try {
      const revenueResult = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            revenue: { $sum: '$total' },
          },
        },
      ]);

      const returnsResult = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            returns: { $sum: 1 },
          },
        },
      ]);

      const merged: Record<string, { year: number; month: number; revenue: number; returns: number }> = {};
      revenueResult.forEach((item) => {
        const key = `${item._id.year}-${item._id.month}`;
        merged[key] = { ...item._id, revenue: item.revenue, returns: 0 };
      });
      returnsResult.forEach((item) => {
        const key = `${item._id.year}-${item._id.month}`;
        if (merged[key]) {
          merged[key].returns = item.returns;
        } else {
          merged[key] = { ...item._id, revenue: 0, returns: item.returns };
        }
      });

      const data = Object.values(merged).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
      const totalReturns = data.reduce((sum, item) => sum + item.returns, 0);

      return { data, totalRevenue, totalReturns };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getRevenueVsReturnsByYears(from: Date, to: Date) {
    try {
      const revenueResult = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' } },
            revenue: { $sum: '$total' },
          },
        },
      ]);

      const returnsResult = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' } },
            returns: { $sum: 1 },
          },
        },
      ]);

      const merged: Record<string, { year: number; revenue: number; returns: number }> = {};
      revenueResult.forEach((item) => {
        const key = `${item._id.year}`;
        merged[key] = { ...item._id, revenue: item.revenue, returns: 0 };
      });
      returnsResult.forEach((item) => {
        const key = `${item._id.year}`;
        if (merged[key]) {
          merged[key].returns = item.returns;
        } else {
          merged[key] = { ...item._id, revenue: 0, returns: item.returns };
        }
      });

      const data = Object.values(merged).sort((a, b) => a.year - b.year);

      const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
      const totalReturns = data.reduce((sum, item) => sum + item.returns, 0);

      return { data, totalRevenue, totalReturns };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Products added analytics
  static async getProductsAddedByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getProductsAddedByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getProductsAddedByYears(from: Date, to: Date) {
    try {
      const result = await Product.aggregate([
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
      return { data: result, total };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Current Carts analytics
  static async getCurrentCartsByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalItems = result.reduce((sum, item) => sum + item.totalItems, 0);
      return { data: result, total, totalItems };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getCurrentCartsByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalItems = result.reduce((sum, item) => sum + item.totalItems, 0);
      return { data: result, total, totalItems };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getCurrentCartsByYears(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalItems = result.reduce((sum, item) => sum + item.totalItems, 0);
      return { data: result, total, totalItems };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Sales analytics
  static async getSalesByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalSalesAmount = result.reduce((sum, item) => sum + item.totalSalesAmount, 0);
      return { data: result, total, totalSalesAmount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getSalesByMonths(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalSalesAmount = result.reduce((sum, item) => sum + item.totalSalesAmount, 0);
      return { data: result, total, totalSalesAmount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getSalesByYears(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalSalesAmount = result.reduce((sum, item) => sum + item.totalSalesAmount, 0);
      return { data: result, total, totalSalesAmount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Sales discount total analytics
  static async getSalesDiscountTotalByDays(from: Date, to: Date) {
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalDiscount = result.reduce((sum, item) => sum + item.totalDiscount, 0);
      return { data: result, total, totalDiscount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getSalesDiscountTotalByMonths(from: Date, to: Date) {
    try {
      const result = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
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
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalDiscount = result.reduce((sum, item) => sum + item.totalDiscount, 0);
      return { data: result, total, totalDiscount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  static async getSalesDiscountTotalByYears(from: Date, to: Date) {
    try {
      const result = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: 'Completed' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' } },
            totalDiscount: { $sum: { $add: ['$couponDiscount', { $sum: '$flashSaleApplied.discount' }] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1 } },
      ]);
      const total = result.reduce((sum, item) => sum + item.count, 0);
      const totalDiscount = result.reduce((sum, item) => sum + item.totalDiscount, 0);
      return { data: result, total, totalDiscount };
    } catch (error) {
      logger.error(`Analytics error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export default AnalyticsService;
