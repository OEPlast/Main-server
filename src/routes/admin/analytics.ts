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

export default router;
