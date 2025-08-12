import { Router } from 'express';
import ReviewService from '@/services/reviewService';

const router = Router();

// Public list endpoint: reviews for product
router.get('/product/:productId', async (req, res) => {
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

export default router;
