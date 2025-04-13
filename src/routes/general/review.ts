import express from 'express';
import { isAuthenticated } from '../../middleware/auth';
import ReviewController from '../../controller/reviewController';

const router = express.Router();

router.post('/:reviewId/like', isAuthenticated, ReviewController.likeReview);
router.post('/:reviewId/unlike', isAuthenticated, ReviewController.unlikeReview);
router.get('/:reviewId/isLikedByUser', isAuthenticated, ReviewController.isLikedByUser);
router.get('/:reviewId/likeCount', isAuthenticated, ReviewController.getLikeCount);

export default router;
