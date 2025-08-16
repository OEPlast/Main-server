import express from 'express';
import { authenticateUser } from '../../middleware/auth';
import ReviewController from '../../controller/reviewController';
import ReviewValidator from '../../validators/ReviewValidator';

const router = express.Router();

// Public routes (no auth required)
router.get('/:reviewId/likeCount', ...ReviewValidator.validateReviewId, ReviewController.getLikeCount);

// Protected routes (auth required)
router.post('/', authenticateUser, ...ReviewValidator.validateCreateReview, ReviewController.createReview);
router.put('/:reviewId', authenticateUser, ...ReviewValidator.validateUpdateReview, ReviewController.updateReview);
router.delete('/:reviewId', authenticateUser, ...ReviewValidator.validateReviewId, ReviewController.deleteReview);

router.post('/:reviewId/like', authenticateUser, ...ReviewValidator.validateReviewId, ReviewController.likeReview);
router.post('/:reviewId/unlike', authenticateUser, ...ReviewValidator.validateReviewId, ReviewController.unlikeReview);
router.get(
  '/:reviewId/isLikedByUser',
  authenticateUser,
  ...ReviewValidator.validateReviewId,
  ReviewController.isLikedByUser
);

export default router;
