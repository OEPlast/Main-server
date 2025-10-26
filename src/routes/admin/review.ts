import Admin_ReviewController from '@/controller/admin/ReviewController';
import ReviewValidator from '@/validators/admin/ReviewValidator';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';
import express from 'express';

const router = express.Router();

// All admin review routes require authentication and admin privileges
router.use(authenticateUser, isAdmin);

// Get all reviews with pagination and filtering
router.get(
  '/',
  requirePermission('reviews', 'read'),
  ...ReviewValidator.validateReviewFilters,
  Admin_ReviewController.getAllReviews
);

// Get review statistics
router.get(
  '/statistics',
  requirePermission('reviews', 'read'),
  Admin_ReviewController.getStatistics
);

// Get mood-based analytics for reviews
router.get(
  '/analytics/mood',
  requirePermission('reviews', 'read'),
  ...ReviewValidator.validateMoodAnalytics,
  Admin_ReviewController.getMoodAnalytics
);

// Get reviews for a specific product
router.get(
  '/product/:id',
  requirePermission('reviews', 'read'),
  ...ReviewValidator.validateProductId,
  ...ReviewValidator.validateReviewFilters,
  Admin_ReviewController.getProductReviews
);

// Get reviews by a specific user
router.get(
  '/user/:userId',
  requirePermission('reviews', 'read'),
  ...ReviewValidator.validateUserId,
  ...ReviewValidator.validateReviewFilters,
  Admin_ReviewController.getUserReviews
);

// Get a single review by ID
router.get(
  '/:id',
  requirePermission('reviews', 'read'),
  ...ReviewValidator.validateReviewId,
  Admin_ReviewController.getReviewById
);

// Moderate a review (approve/reject)
router.patch(
  '/:id/moderate',
  requirePermission('reviews', 'update'),
  ...ReviewValidator.validateModeration,
  Admin_ReviewController.moderateReview
);

// Update a review
router.put(
  '/:id',
  requirePermission('reviews', 'update'),
  ...ReviewValidator.validateReviewUpdate,
  Admin_ReviewController.updateReview
);

// Delete a review
router.delete(
  '/:id',
  requirePermission('reviews', 'delete'),
  ...ReviewValidator.validateReviewId,
  Admin_ReviewController.deleteReview
);

// Add reply to a review
router.post(
  '/:id/reply',
  requirePermission('reviews', 'update'),
  ...ReviewValidator.validateAddReply,
  Admin_ReviewController.addReply
);

// Update reply in a review
router.put(
  '/:reviewId/reply/:replyId',
  requirePermission('reviews', 'update'),
  ...ReviewValidator.validateUpdateReply,
  Admin_ReviewController.updateReply
);

// Delete reply from a review
router.delete(
  '/:reviewId/reply/:replyId',
  requirePermission('reviews', 'delete'),
  ...ReviewValidator.validateDeleteReply,
  Admin_ReviewController.deleteReply
);

export default router;
