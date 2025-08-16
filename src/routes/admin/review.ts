import Admin_ReviewController from '@/controller/admin/ReviewController';
import ReviewValidator from '@/validators/admin/ReviewValidator';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';
import express from 'express';

const router = express.Router();

// All admin review routes require authentication and admin privileges
router.use(authenticateUser, isAdmin);

router.get(
  '/product/:id',
  requirePermission('reviews', 'read'),
  ReviewValidator.productIdValidator,
  Admin_ReviewController.getProductReviews
);
router.delete(
  '/:id',
  requirePermission('reviews', 'delete'),
  ReviewValidator.reviewIdValidator,
  Admin_ReviewController.deleteReview
);
router.post(
  '/:id/reply',
  requirePermission('reviews', 'update'),
  ReviewValidator.addReplyValidator,
  Admin_ReviewController.addReply
);
router.put(
  '/:id/reply',
  requirePermission('reviews', 'update'),
  ReviewValidator.updateReplyValidator,
  Admin_ReviewController.updateReply
);
router.delete(
  '/:id/reply',
  requirePermission('reviews', 'delete'),
  ReviewValidator.reviewIdValidator,
  Admin_ReviewController.deleteReview
);

export default router;
