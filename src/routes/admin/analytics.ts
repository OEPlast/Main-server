import { Router } from 'express';
import { validateAnalyticsQuery } from '@/validators/admin/AnalyticsValidator';
import Admin_AnalyticsController from '@/controller/admin/AnalyticsController';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';

const router = Router();

router.get(
  '/seller-statistics',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSellerStatistics
);
router.get(
  '/total-sales',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTotalSales
);
router.get(
  '/chart-data',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getChartData
);
router.get(
  '/order-vs-returns',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderVsReturns
);
router.get(
  '/range-count',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getRangeCount
);
router.get(
  '/paginated-statistics-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsDays
);
router.get(
  '/paginated-statistics-weeks',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsWeeks
);
router.get(
  '/paginated-statistics-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsMonths
);
router.get(
  '/paginated-statistics-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsYears
);
router.get(
  '/wishlist-frequency-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getWishlistFrequencyByDays
);
router.get(
  '/wishlist-frequency-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getWishlistFrequencyByMonths
);
router.get(
  '/wishlist-frequency-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getWishlistFrequencyByYears
);
router.get(
  '/orders-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrdersByDays
);
router.get(
  '/orders-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrdersByMonths
);
router.get(
  '/orders-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrdersByYears
);
router.get(
  '/order-cancelled-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderCancelledByDays
);
router.get(
  '/order-cancelled-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderCancelledByMonths
);
router.get(
  '/order-cancelled-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderCancelledByYears
);
router.get(
  '/shipments-delivered-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getShipmentsDeliveredByDays
);
router.get(
  '/shipments-delivered-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getShipmentsDeliveredByMonths
);
router.get(
  '/shipments-delivered-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getShipmentsDeliveredByYears
);
router.get(
  '/order-returned-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderReturnedByDays
);
router.get(
  '/order-returned-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderReturnedByMonths
);
router.get(
  '/order-returned-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderReturnedByYears
);
router.get(
  '/order-failed-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderFailedByDays
);
router.get(
  '/order-failed-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderFailedByMonths
);
router.get(
  '/order-failed-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderFailedByYears
);
router.get(
  '/shipments-in-warehouse-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getShipmentsInWarehouseByDays
);
router.get(
  '/shipments-in-warehouse-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getShipmentsInWarehouseByMonths
);
router.get(
  '/shipments-in-warehouse-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getShipmentsInWarehouseByYears
);
router.get(
  '/transactions-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTransactionsByDays
);
router.get(
  '/transactions-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTransactionsByMonths
);
router.get(
  '/transactions-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTransactionsByYears
);
router.get(
  '/total-transactions-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTotalTransactionsByDays
);
router.get(
  '/total-transactions-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTotalTransactionsByMonths
);
router.get(
  '/total-transactions-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTotalTransactionsByYears
);
router.get(
  '/user-joining-rate-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getUserJoiningRateByDays
);
router.get(
  '/user-joining-rate-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getUserJoiningRateByMonths
);
router.get(
  '/user-joining-rate-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getUserJoiningRateByYears
);
router.get(
  '/coupon-redemption-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCouponRedemptionByDays
);
router.get(
  '/coupon-redemption-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCouponRedemptionByMonths
);
router.get(
  '/coupon-redemption-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCouponRedemptionByYears
);
router.get(
  '/reviews-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewsByDays
);
router.get(
  '/reviews-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewsByMonths
);
router.get(
  '/reviews-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewsByYears
);
router.get(
  '/review-rate-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewRateByDays
);
router.get(
  '/review-rate-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewRateByMonths
);
router.get(
  '/review-rate-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewRateByYears
);
router.get(
  '/review-mood-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewMoodByDays
);
router.get(
  '/review-mood-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewMoodByMonths
);
router.get(
  '/review-mood-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewMoodByYears
);
router.get(
  '/revenue-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getRevenueByDays
);
router.get(
  '/revenue-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getRevenueByMonths
);
router.get(
  '/revenue-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getRevenueByYears
);
router.get(
  '/products-added-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getProductsAddedByDays
);
router.get(
  '/products-added-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getProductsAddedByMonths
);
router.get(
  '/products-added-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getProductsAddedByYears
);
router.get(
  '/current-carts-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCurrentCartsByDays
);
router.get(
  '/current-carts-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCurrentCartsByMonths
);
router.get(
  '/current-carts-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCurrentCartsByYears
);
router.get(
  '/sales-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSalesByDays
);
router.get(
  '/sales-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSalesByMonths
);
router.get(
  '/sales-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSalesByYears
);
router.get(
  '/sales-discount-total-days',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSalesDiscountTotalByDays
);
router.get(
  '/sales-discount-total-months',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSalesDiscountTotalByMonths
);
router.get(
  '/sales-discount-total-years',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSalesDiscountTotalByYears
);

// ============================================
// NEW ANALYTICS ENDPOINTS FOR ADMIN DASHBOARD
// ============================================

// Overview Endpoints (Stats Cards with Mini Charts)
router.get(
  '/sales-overview',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSalesOverview
);
router.get(
  '/orders-overview',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrdersOverview
);
router.get(
  '/transactions-overview',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTransactionsOverview
);
router.get(
  '/users-overview',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getUsersOverview
);
router.get(
  '/products-overview',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getProductsOverview
);
router.get(
  '/reviews-overview',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewsOverview
);
router.get(
  '/coupons-overview',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCouponsOverview
);

// Chart Endpoints
router.get(
  '/revenue-expense-chart',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getRevenueExpenseChart
);
router.get(
  '/orders-trend',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrdersTrend
);
router.get(
  '/transactions-trend',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTransactionsTrend
);
router.get(
  '/customer-acquisition',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCustomerAcquisition
);
router.get(
  '/profit-loss-chart',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getProfitLossChart
);
router.get(
  '/order-status-distribution',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderStatusDistribution
);
router.get(
  '/transaction-status-distribution',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTransactionStatusDistribution
);
router.get(
  '/rating-distribution',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getRatingDistribution
);
router.get(
  '/review-sentiment',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewSentiment
);
router.get(
  '/coupon-redemption-trend',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCouponRedemptionTrend
);
router.get(
  '/payment-methods',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaymentMethods
);
router.get(
  '/top-products-revenue',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTopProductsRevenue
);
router.get(
  '/categories-performance',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCategoriesPerformance
);
router.get(
  '/user-demographics',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getUserDemographics
);
router.get(
  '/coupon-type-distribution',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getCouponTypeDistribution
);

// Table Endpoints (with Pagination)
router.get(
  '/sales-by-category',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSalesByCategory
);
router.get(
  '/top-selling-products',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTopSellingProducts
);
router.get(
  '/orders-table',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrdersTable
);
router.get(
  '/transactions-table',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTransactionsTable
);
router.get(
  '/top-customers',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTopCustomers
);
router.get(
  '/product-performance',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getProductPerformance
);
router.get(
  '/reviews-table',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getReviewsTable
);
router.get(
  '/top-coupons',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTopCoupons
);
router.get(
  '/most-wishlisted-products',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getMostWishlistedProducts
);
router.get(
  '/most-reviewed-products',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getMostReviewedProducts
);
router.get(
  '/low-stock-products',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  Admin_AnalyticsController.getLowStockProducts
);

export default router;
