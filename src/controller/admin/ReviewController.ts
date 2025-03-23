import { Request, Response } from 'express';
import Admin_ReviewService from '@/services/admin/Review';
import ReviewService from '@/services/reviewService';

// Get product reviews
const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await ReviewService.getReviewsByProductId(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getProductReviews:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete review
const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await Admin_ReviewService.deleteReview({ reviewId: id });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Add reply to review
const addReply = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    const { data, code, message } = await Admin_ReviewService.addReply(id, reply);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in addReply:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update reply to review
const updateReply = async (req: Request, res: Response) => {
  try {
    const { reviewId, replyId } = req.params;
    const { reply } = req.body;
    const { data, code, message } = await Admin_ReviewService.updateReply({ reviewId, replyId, updatedReply: reply });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in updateReply:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete reply to review
const deleteReply = async (req: Request, res: Response) => {
  try {
    const { reviewId, replyId } = req.params;
    const { data, code, message } = await Admin_ReviewService.deleteReply({ reviewId, replyId });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteReply:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const Admin_ReviewController = {
  getProductReviews,
  deleteReview,
  addReply,
  updateReply,
  deleteReply,
};

export default Admin_ReviewController;
