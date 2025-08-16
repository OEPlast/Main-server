import express from 'express';
import ReviewController from '../../controller/reviewController';
import ReviewValidator from '../../validators/ReviewValidator';
import { authenticateUser } from '../../middleware/auth';

const router = express.Router();

// All review routes require authentication
router.use(authenticateUser);

router.get('/me', ReviewController.getUserReviews);
router.get('/product/:product', ReviewController.getUserProductReview);
router.post('/', ...ReviewValidator.validateCreateReview, ReviewController.createReview);
router.put('/:id', ...ReviewValidator.validateUpdateReview, ReviewController.updateReview);
router.delete('/:id', ...ReviewValidator.validateReviewId, ReviewController.deleteReview);

export default router;
