import { logger } from '@/lib/logger';
import Statistics from '@/models/Statistics';
import StatisticsService from './admin/StatisticsService';

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
      await StatisticsService.incrementAnalyticalField('totalOrders', 1);
      await StatisticsService.incrementAnalyticalField('totalAmount', amount);
      await StatisticsService.incrementAnalyticalField('totalRevenue', amount);
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
      await StatisticsService.incrementAnalyticalField('totalSales', 1);
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
      await StatisticsService.incrementAnalyticalField('totalReturns', 1);
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
      await StatisticsService.incrementAnalyticalField('totalCustomers', 1);
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
  static async trackCouponUsed(couponId: string, userId: string, discountAmount: number): Promise<void> {
    try {
      // Log coupon usage for future analytics expansions
      logger.info(`Analytics: Coupon used - Coupon: ${couponId}, User: ${userId}, Discount: ${discountAmount}`);
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
      return await Statistics.find({
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 });
    } catch (error) {
      logger.error(
        `Analytics error retrieving analytics data: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}

export default AnalyticsService;
