import express from 'express';
import ReviewController from '../../controller/reviewController';
import ReviewValidator from '../../validators/ReviewValidator';
import { authenticateUser } from '../../middleware/auth';

const router = express.Router();

// All review routes require authentication
router.use(authenticateUser);
//all reviews by auth user
router.get('/all', ReviewController.getUserReviews);
//review on one product - supports pagination with cursor and limit query params
router.get('/product/:product', ReviewController.getUserProductReview);
//create reveiw
router.post('/', ...ReviewValidator.validateCreateReview, ReviewController.createReview);
//edit review
router.put('/:id', ...ReviewValidator.validateUpdateReview, ReviewController.updateReview);
//delete review
router.delete('/:id', ...ReviewValidator.validateReviewId, ReviewController.deleteReview);

export default router;
