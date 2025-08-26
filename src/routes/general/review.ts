import express from 'express';
import { authenticateUser, authenticateUser_No_Force } from '../../middleware/auth';
import ReviewController from '../../controller/reviewController';
import ReviewValidator from '../../validators/ReviewValidator';
import ReviewService from '@/services/reviewService';

const router = express.Router();

// reviews for product
//TODO: add pagination
router.get('/product/:productId', authenticateUser_No_Force, async (req, res) => {
  try {
    const { productId } = req.params;
    const page = Number(req.query.page || 1);
    const { data, message, code } = await ReviewService.allReviews(productId, page);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error listing product reviews:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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
