import { Router } from 'express';
import { validateAnalyticsQuery } from '@/validators/admin/AnalyticsValidator';
import Admin_AnalyticsController from '@/controller/admin/AnalyticsController';

const router = Router();

router.get('/seller-statistics', validateAnalyticsQuery, Admin_AnalyticsController.getSellerStatistics);
router.get('/total-sales', validateAnalyticsQuery, Admin_AnalyticsController.getTotalSales);
router.get('/chart-data', validateAnalyticsQuery, Admin_AnalyticsController.getChartData);
router.get('/order-vs-returns', validateAnalyticsQuery, Admin_AnalyticsController.getOrderVsReturns);
router.get('/range-count', validateAnalyticsQuery, Admin_AnalyticsController.getRangeCount);
router.get('/paginated-statistics-days', validateAnalyticsQuery, Admin_AnalyticsController.getPaginatedStatisticsDays);
router.get(
  '/paginated-statistics-weeks',
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsWeeks
);
router.get(
  '/paginated-statistics-months',
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsMonths
);
router.get(
  '/paginated-statistics-years',
  validateAnalyticsQuery,
  Admin_AnalyticsController.getPaginatedStatisticsYears
);

export default router;
