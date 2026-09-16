import { Router } from 'express';
import { validateAnalyticsQuery } from '@/validators/admin/AnalyticsValidator';
import {
  validateBreakdownQuery,
  validateProductPerformanceQuery,
  validateSeriesQuery,
  validateSummaryQuery,
} from '@/validators/admin/AnalyticsQueryValidator';
import Admin_AnalyticsController from '@/controller/admin/AnalyticsController';
import Admin_AnalyticsQueryController from '@/controller/admin/AnalyticsQueryController';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';

const router = Router();

// =============================================================================
// QUERY ENGINE
//
// Every number these return is computed from the metric registry
// (services/admin/analytics/metrics.ts), which declares the timestamp each metric is measured on.
// =============================================================================

router.get(
  '/series',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateSeriesQuery,
  Admin_AnalyticsQueryController.getSeries
);

router.get(
  '/summary',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateSummaryQuery,
  Admin_AnalyticsQueryController.getSummary
);

router.get(
  '/breakdown',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateBreakdownQuery,
  Admin_AnalyticsQueryController.getBreakdown
);

router.get(
  '/meta',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  Admin_AnalyticsQueryController.getMeta
);

router.get(
  '/products/:productId/performance',
  authenticateUser,
  isAdmin,
  requirePermission('analytics', 'read'),
  validateProductPerformanceQuery,
  Admin_AnalyticsQueryController.getProductPerformance
);

// =============================================================================
// ROW LISTINGS
//
// Filtered document listings (per-row detail such as product images), which the metric engine
// deliberately does not model. Used by the dashboard and the analytics tables.
//
// The ~93 other legacy endpoints that used to sit here were deleted on 2026-09-15: nothing in the
// admin app, storefront, event-bus or crons called them, and the store had no production
// deployment that an outside caller could have depended on.
// =============================================================================

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

export default router;
