import { Request, Response } from 'express';
import { AuthenticatedRequest, isAuthenticatedRequest } from '@/types';
import ReviewService from '@/services/reviewService';
import Review from '@/models/Review';
import Order from '@/models/Order';
import { ObjectId } from 'mongodb';

// Get product review statistics
const getProductReviewStats = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { code, message, data } = await ReviewService.getProductReviewStats(productId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductReviewStats:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get all reviews (deprecated - use getOneProductReview instead)
const getReviews = async (req: Request, res: Response) => {
  try {
    const { product } = req.body;
    const cursor = req.query.cursor as string | undefined;
    const limit = Number(req.query.limit) || 15;
    const { code, message, data, meta } = await ReviewService.allReviews(product, cursor, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getReviews:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Create a new review
const createReview = async (req: Request, res: Response) => {
  try {
    const { product, rating, review, title, size, style, fit, images } = req.body;
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const userId = req.userId;
    const { data, code, message } = await ReviewService.createReview({
      reviewBy: userId!,
      product,
      rating,
      review,
      title,
      size,
      style,
      fit,
      images,
      // Note: transactionId and orderId will be determined by the service
      transactionId: '', // Will be populated by service
      orderId: '', // Will be populated by service
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
    const { review, rating, title } = req.body;
    const { data, message, code } = await ReviewService.updateReview(id, { review, rating, title });
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
    const userId = (req as AuthenticatedRequest).userId!;
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
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
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
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
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
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
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
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
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
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
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
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const userId = req.userId;
    const { product } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = Number(req.query.limit) || 15;

    const { data, message, code, meta } = await ReviewService.userReviewPerProduct({
      productId: product,
      userId: userId!,
      cursor,
      limit,
    });
    return res.status(code).json({ data, message, meta });
  } catch (error) {
    console.error('Error in getUserProductReview:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

const getOneProductReview = async (req: Request, res: Response) => {
  try {
    // Optional authentication - get userId if authenticated, otherwise undefined
    const userId = isAuthenticatedRequest(req) ? req.userId : undefined;
    const { productId } = req.params;

    // Cursor pagination parameters
    const cursor = req.query.cursor as string | undefined;
    const limit = Number(req.query.limit) || 15;

    // Filter parameters
    const sortByParam = req.query.sortBy as string | undefined;
    let rating: number | undefined = req.query.rating ? Number(req.query.rating) : undefined;
    let sortBy: 'newest' | 'helpful' | 'rating-high' | 'rating-low' | undefined = sortByParam as any;

    // Handle star-based sorting (5star, 4star, etc.)
    if (sortByParam && /^[1-5]star$/.test(sortByParam)) {
      rating = Number(sortByParam.replace('star', ''));
      sortBy = 'newest'; // Sort by newest when filtering by star rating
    }

    const filters = {
      rating,
      hasImages: req.query.hasImages === 'true' ? true : undefined,
      sortBy,
    };

    const { data, message, code, meta } = await ReviewService.allReviews(productId, cursor, limit, userId, filters);
    return res.status(code).json({ data, message, meta });
  } catch (error) {
    console.error('Error in getOneProductReview:', error);
    return res.status(404).json({ error: 'Something went wrong' });
  }
};

// Check if user can review a product (purchase verification + existing review check)
const canReview = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    // Check if user is authenticated
    if (!isAuthenticatedRequest(req)) {
      return res.status(200).json({
        message: 'Login required to review products',
        data: {
          canReview: false,
          reason: 'Login required',
        },
      });
    }

    const userId = req.userId!;

    // Check if user has already reviewed this product
    const existingReview = await Review.aggregate([
      {
        $match: {
          product: new ObjectId(productId),
          reviewBy: new ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'reviewBy',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ['$likes', []] } },
          repliesCount: { $size: { $ifNull: ['$replies', []] } },
        },
      },
      {
        $project: {
          _id: 1,
          rating: 1,
          review: 1,
          title: 1,
          images: 1,
          size: 1,
          style: 1,
          fit: 1,
          likesCount: 1,
          repliesCount: 1,
          createdAt: 1,
          updatedAt: 1,
          reviewBy: {
            _id: '$reviewBy',
            firstName: '$userDetails.firstName',
            lastName: '$userDetails.lastName',
            image: '$userDetails.image',
          },
        },
      },
    ]);

    if (existingReview && existingReview.length > 0) {
      // User has already reviewed, but check if they bought again
      const eligibility = await (ReviewService as any).verifyPurchaseEligibility?.(userId, productId);

      // If user has purchased again, they can update their review
      const canUpdate = eligibility?.eligible || false;

      let orderInfo;
      if (canUpdate && eligibility) {
        // Get order details to extract qty and attributes for the new purchase
        const order = await Order.findById(eligibility.orderId).select('products');
        if (order) {
          const productInOrder = order.products.find((p: any) => p.product.toString() === productId);
          if (productInOrder) {
            orderInfo = {
              transactionId: eligibility.transactionId,
              orderId: eligibility.orderId,
              qty: productInOrder.qty,
              attributes: productInOrder.attributes || [],
            };
          }
        }
      }

      return res.status(200).json({
        message: canUpdate
          ? 'You have already reviewed this product, but you can update it since you purchased again'
          : 'You have already reviewed this product',
        data: {
          canReview: false,
          canUpdate,
          reason: 'Already reviewed',
          hasExistingReview: true,
          existingReview: existingReview[0],
          ...(orderInfo ? { orderInfo } : {}),
        },
      });
    }

    // Verify purchase eligibility using existing service method
    const eligibility = await (ReviewService as any).verifyPurchaseEligibility?.(userId, productId);

    if (!eligibility) {
      return res.status(500).json({
        message: 'Unable to verify purchase eligibility',
        data: {
          canReview: false,
          reason: 'Verification error',
        },
      });
    }

    if (!eligibility.eligible) {
      return res.status(200).json({
        message: eligibility.message || 'Not eligible to review this product',
        data: {
          canReview: false,
          reason: eligibility.message || 'Purchase not verified',
        },
      });
    }

    // Get order details to extract qty and attributes
    const order = await Order.findById(eligibility.orderId).select('products');

    if (!order) {
      return res.status(200).json({
        message: 'Order information not found',
        data: {
          canReview: false,
          reason: 'Order not found',
        },
      });
    }

    // Find the specific product in the order
    const productInOrder = order.products.find((p: any) => p.product.toString() === productId);

    if (!productInOrder) {
      return res.status(200).json({
        message: 'Product not found in order',
        data: {
          canReview: false,
          reason: 'Product not in order',
        },
      });
    }

    // User is eligible to review
    return res.status(200).json({
      message: 'You can review this product',
      data: {
        canReview: true,
        orderInfo: {
          transactionId: eligibility.transactionId,
          orderId: eligibility.orderId,
          qty: productInOrder.qty,
          attributes: productInOrder.attributes || [],
        },
      },
    });
  } catch (error) {
    console.error('Error in canReview:', error);
    return res.status(500).json({
      message: 'Something went wrong',
      data: {
        canReview: false,
        reason: 'Server error',
      },
    });
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
  getOneProductReview,
  getProductReviewStats,
  canReview,
};

export default ReviewController;
