import express from 'express';
import { isAuthenticated } from '../../middleware/auth';
import ReviewController from '../../controller/reviewController';
import ReviewValidator from '../../validators/ReviewValidator';

const router = express.Router();

// Public routes (no auth required)
router.get('/:reviewId/likeCount', ...ReviewValidator.validateReviewId, ReviewController.getLikeCount);

// Protected routes (auth required)
router.post('/', isAuthenticated, ...ReviewValidator.validateCreateReview, ReviewController.createReview);
router.put('/:reviewId', isAuthenticated, ...ReviewValidator.validateUpdateReview, ReviewController.updateReview);
router.delete('/:reviewId', isAuthenticated, ...ReviewValidator.validateReviewId, ReviewController.deleteReview);

router.post('/:reviewId/like', isAuthenticated, ...ReviewValidator.validateReviewId, ReviewController.likeReview);
router.post('/:reviewId/unlike', isAuthenticated, ...ReviewValidator.validateReviewId, ReviewController.unlikeReview);
router.get(
  '/:reviewId/isLikedByUser',
  isAuthenticated,
  ...ReviewValidator.validateReviewId,
  ReviewController.isLikedByUser
);

export default router;
