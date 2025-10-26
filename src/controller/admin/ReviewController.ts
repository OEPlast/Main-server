import { Request, Response } from 'express';
import { AuthenticatedRequest, isAuthenticatedRequest } from '@/types';
import Admin_ReviewService from '@/services/admin/Review';
import ReviewService from '@/services/reviewService';

// Get all reviews with pagination and filtering
const getAllReviews = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      rating,
      isApproved,
      productId,
      userId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      ...(rating && { rating: parseInt(rating as string) }),
      ...(isApproved !== undefined && { isApproved: isApproved === 'true' }),
      ...(productId && { productId: productId as string }),
      ...(userId && { userId: userId as string }),
      ...(startDate && { startDate: startDate as string }),
      ...(endDate && { endDate: endDate as string }),
      sortBy: sortBy as 'createdAt' | 'rating' | 'helpful',
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    const result = await Admin_ReviewService.getAllReviews(filters);
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in getAllReviews:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get a single review by ID
const getReviewById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await Admin_ReviewService.getReviewById(id);
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in getReviewById:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get product reviews
const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 10,
      rating,
      isApproved,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      ...(rating && { rating: parseInt(rating as string) }),
      ...(isApproved !== undefined && { isApproved: isApproved === 'true' }),
      sortBy: sortBy as 'createdAt' | 'rating' | 'helpful',
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    const result = await Admin_ReviewService.getReviewsByProductId(id, filters);
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in getProductReviews:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get user reviews
const getUserReviews = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 10,
      rating,
      isApproved,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      ...(rating && { rating: parseInt(rating as string) }),
      ...(isApproved !== undefined && { isApproved: isApproved === 'true' }),
      sortBy: sortBy as 'createdAt' | 'rating' | 'helpful',
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    const result = await Admin_ReviewService.getReviewsByUserId(userId, filters);
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in getUserReviews:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Moderate review (approve/reject)
const moderateReview = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const { id } = req.params;
    const { isApproved, moderationNote } = req.body;
    const adminId = req.userId;

    const result = await Admin_ReviewService.moderateReview(id, adminId, isApproved, moderationNote);
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in moderateReview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update review
const updateReview = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const { id } = req.params;
    const { review, rating, title, moderationNote } = req.body;
    const adminId = req.userId;

    const updateData = {
      ...(review && { review }),
      ...(rating && { rating }),
      ...(title && { title }),
      ...(moderationNote && { moderationNote }),
    };

    const result = await Admin_ReviewService.updateReview(id, adminId, updateData);
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in updateReview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete review
const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await Admin_ReviewService.deleteReview({ reviewId: id });
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get mood-based analytics
const getMoodAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, productId, categoryId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required',
        message: 'Please provide both startDate and endDate parameters'
      });
    }

    const filters = {
      startDate: startDate as string,
      endDate: endDate as string,
      ...(productId && { productId: productId as string }),
      ...(categoryId && { categoryId: categoryId as string }),
    };

    const result = await Admin_ReviewService.getMoodBasedAnalysis(filters);
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in getMoodAnalytics:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Add reply to review
const addReply = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const { id } = req.params;
    const { reply } = req.body;
    const adminId = req.userId;

    const result = await Admin_ReviewService.addReply(id, reply, adminId);
    return res.status(result.code).json(result);
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
    
    const result = await Admin_ReviewService.updateReply({ 
      reviewId, 
      replyId, 
      updatedReply: reply 
    });
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in updateReply:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete reply from review
const deleteReply = async (req: Request, res: Response) => {
  try {
    const { reviewId, replyId } = req.params;
    const result = await Admin_ReviewService.deleteReply({ reviewId, replyId });
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in deleteReply:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get review statistics
const getStatistics = async (req: Request, res: Response) => {
  try {
    const result = await Admin_ReviewService.getStatistics();
    return res.status(result.code).json(result);
  } catch (error) {
    console.error('Error in getStatistics:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const Admin_ReviewController = {
  getAllReviews,
  getReviewById,
  getProductReviews,
  getUserReviews,
  moderateReview,
  updateReview,
  deleteReview,
  getMoodAnalytics,
  getStatistics,
  addReply,
  updateReply,
  deleteReply,
};

export default Admin_ReviewController;
