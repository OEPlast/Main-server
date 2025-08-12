import { Router } from 'express';
import { validateAnalyticsQuery } from '@/validators/admin/AnalyticsValidator';
import Admin_AnalyticsController from '@/controller/admin/AnalyticsController';
import { isAuthenticated, isAdmin, requirePermission } from '@/middleware/auth';

const router = Router();

router.get(
  '/seller-statistics',
  isAuthenticated,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getSellerStatistics
);
router.get(
  '/total-sales',
  isAuthenticated,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getTotalSales
);
router.get(
  '/chart-data',
  isAuthenticated,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getChartData
);
router.get(
  '/order-vs-returns',
  isAuthenticated,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getOrderVsReturns
);
router.get(
  '/range-count',
  isAuthenticated,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getRangeCount
);
router.get(
  '/paginated-statistics-days',
  isAuthenticated,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsDays
);
router.get(
  '/paginated-statistics-weeks',
  isAuthenticated,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsWeeks
);
router.get(
  '/paginated-statistics-months',
  isAuthenticated,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsMonths
);
router.get(
  '/paginated-statistics-years',
  isAuthenticated,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsYears
);

export default router;
