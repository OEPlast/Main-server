import express from 'express';
import ReviewController from '../../controller/reviewController';

const router = express.Router();

router.get('/all', ReviewController.getReviews);
router.post('/new', ReviewController.createReview);
router.get('/me', ReviewController.getUserReviews);
router.get('/one/:id', ReviewController.getUserProductReview);
router.put('/one/:id', ReviewController.updateReview);
router.delete('/one/:id', ReviewController.deleteReview);

export default router;
