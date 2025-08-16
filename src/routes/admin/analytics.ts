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

export default router;
