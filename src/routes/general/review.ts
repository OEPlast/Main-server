import express from 'express';
import { authenticateUser, authenticateUser_No_Force } from '../../middleware/auth';
import ReviewController from '../../controller/reviewController';
import ReviewValidator from '../../validators/ReviewValidator';

const router = express.Router();

// reviews for product with cursor pagination and filters
router.get('/product/:productId', authenticateUser_No_Force, ReviewController.getOneProductReview);

// get review statistics for a product (total, average, star distribution)
router.get('/product/:productId/stats', ReviewController.getProductReviewStats);

// get likes for one review <not needed?>
router.get('/:reviewId/likeCount', ...ReviewValidator.validateReviewId, ReviewController.getLikeCount);

// Protected routes (auth required)
router.post('/:reviewId/like', authenticateUser, ...ReviewValidator.validateReviewId, ReviewController.likeReview);
router.post('/:reviewId/unlike', authenticateUser, ...ReviewValidator.validateReviewId, ReviewController.unlikeReview);
router.get(
  '/:reviewId/isLikedByUser',
  authenticateUser,
  ...ReviewValidator.validateReviewId,
  ReviewController.isLikedByUser
);

export default router;
