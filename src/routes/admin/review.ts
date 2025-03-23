import Admin_ReviewController from '@/controller/admin/ReviewController';
import express from 'express';
const router = express.Router();

router.get('/product/:id', Admin_ReviewController.getProductReviews);
router.delete('/:id', Admin_ReviewController.deleteReview);
router.post('/:id/reply', Admin_ReviewController.addReply);
router.put('/:id/reply', Admin_ReviewController.updateReply);
router.delete('/:id/reply', Admin_ReviewController.deleteReview);

export default router;
