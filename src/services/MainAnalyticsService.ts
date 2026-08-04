import mongoose from 'mongoose';
import { logger } from '@/lib/logger';
import StatisticsService, { StatisticsType } from '@/models/Statistics';

/**
 * Write-path analytics tracking, slated for removal: this opens a Mongo
 * transaction per increment, so `trackOrderPlaced` opens three on the checkout
 * path. The query engine reads straight off document timestamps and does not
 * need the `Statistics` collection.
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

const trackOrderPlaced = async (orderId: string, amount: number): Promise<void> => {
  try {
    await incrementAnalyticalField('totalOrders', 1);
    await incrementAnalyticalField('totalAmount', amount);
    await incrementAnalyticalField('totalRevenue', amount);
    logger.info(`Analytics: Order placed - ID: ${orderId}, Amount: ${amount}`);
  } catch (error) {
    logger.error(`Analytics error tracking order placed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const trackOrderCompleted = async (orderId: string, amount: number): Promise<void> => {
  try {
    await incrementAnalyticalField('totalSales', 1);
    logger.info(`Analytics: Order completed - ID: ${orderId}, Amount: ${amount}`);
  } catch (error) {
    logger.error(`Analytics error tracking order completion: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const trackOrderReturned = async (orderId: string): Promise<void> => {
  try {
    await incrementAnalyticalField('totalReturns', 1);
    logger.info(`Analytics: Order returned - ID: ${orderId}`);
  } catch (error) {
    logger.error(`Analytics error tracking order return: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const trackNewCustomer = async (userId: string): Promise<void> => {
  try {
    await incrementAnalyticalField('totalCustomers', 1);
    logger.info(`Analytics: New customer registered - ID: ${userId}`);
  } catch (error) {
    logger.error(`Analytics error tracking new customer: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// The four below only log — no counter exists for them yet.
const trackItemAddedToCart = async (userId: string, productId: string, amount: number): Promise<void> => {
  try {
    logger.info(`Analytics: Item added to cart - User: ${userId}, Product: ${productId}, Amount: ${amount}`);
  } catch (error) {
    logger.error(
      `Analytics error tracking item added to cart: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const trackItemAddedToWishlist = async (userId: string, productId: string): Promise<void> => {
  try {
    logger.info(`Analytics: Item added to wishlist - User: ${userId}, Product: ${productId}`);
  } catch (error) {
    logger.error(
      `Analytics error tracking item added to wishlist: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const trackProductView = async (productId: string, userId?: string): Promise<void> => {
  try {
    logger.info(`Analytics: Product viewed - Product: ${productId}${userId ? `, User: ${userId}` : ''}`);
  } catch (error) {
    logger.error(`Analytics error tracking product view: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const trackReviewCreated = async (reviewId: string, productId: string, userId: string): Promise<void> => {
  try {
    logger.info(`Analytics: Review created - Review: ${reviewId}, Product: ${productId}, User: ${userId}`);
  } catch (error) {
    logger.error(`Analytics error tracking review created: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const trackCouponUsed = async (couponId: string, userId: string): Promise<void> => {
  try {
    logger.info(`Analytics: Coupon used - Coupon: ${couponId}, User: ${userId}`);
  } catch (error) {
    logger.error(`Analytics error tracking coupon used: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const AnalyticsService = {
  trackOrderPlaced,
  trackOrderCompleted,
  trackOrderReturned,
  trackNewCustomer,
  trackItemAddedToCart,
  trackItemAddedToWishlist,
  trackProductView,
  trackReviewCreated,
  trackCouponUsed,
};

export default AnalyticsService;
