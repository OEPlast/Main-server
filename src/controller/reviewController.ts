import { Request, Response } from 'express';
import ReviewService from '@/services/reviewService';

// Get all reviews
const getReviews = async (req: Request, res: Response) => {
  try {
    const { product } = req.body;
    const { page } = req.params;
    const { code, message, data } = await ReviewService.allReviews(product, ~~page);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviews:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Create a new review
const createReview = async (req: Request, res: Response) => {
  try {
    const { product, rating, review, size, style, fit, images } = req.body;
    const userId = req.userId;
    const { data, code, message } = await ReviewService.createReview({
      reviewBy: userId!,
      product,
      rating,
      review,
      size,
      style,
      fit,
      images,
    });
    // Logic to create a new review
    res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in createReview:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Update a review
const updateReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { review, rating } = req.body;
    const { data, message, code } = await ReviewService.updateReview(id, { review, rating });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateReview:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Delete a review
const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { data, code, message } = await ReviewService.deleteReview({ reviewBy: userId, reviewId: id });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Like a review
const likeReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const userId = req.userId;
    const { data, message, code } = await ReviewService.likeReview(reviewId, userId!);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in likeReview:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Unlike a review
const unlikeReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const userId = req.userId;
    const { data, message, code } = await ReviewService.unlikeReview(reviewId, userId!);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in unlikeReview:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Check if review is liked by user
const isLikedByUser = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const userId = req.userId;
    const { data, message, code } = await ReviewService.isLikedByUser(reviewId, userId!);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in isLikedByUser:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Get like count of a review
const getLikeCount = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { data, message, code } = await ReviewService.getLikeCount(reviewId);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getLikeCount:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Delete a reply from a review
const deleteReply = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { reviewId, replyId } = req.params;
    const { data, message, code } = await ReviewService.deleteReply(reviewId, replyId, userId!);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteReply:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// get all the review a user has made
const getUserReviews = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { page } = req.params;
    const { data, message, code } = await ReviewService.userReviews(userId!, ~~page);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteReply:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// get the review a user has made for a product
const getUserProductReview = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { product } = req.params;
    const { data, message, code } = await ReviewService.userReviewPerProduct({ productId: product, userId: userId! });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteReply:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

const ReviewController = {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
  likeReview,
  unlikeReview,
  isLikedByUser,
  getLikeCount,
  deleteReply,
  getUserReviews,
  getUserProductReview,
};

export default ReviewController;
