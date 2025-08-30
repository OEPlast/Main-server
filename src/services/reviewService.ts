import Review, { ReviewType } from '../models/Review';
import Reply from '@/models/Reply';
import Order from '@/models/Order';
import Transaction from '@/models/Transaction';
import { ObjectId } from 'mongodb';
import AnalyticsService from './MainAnalyticsService';

type IReview = {
  product: string;
  reviewBy: string;
  rating: number;
  review: string;
  title?: string;
  size?: string;
  style?: { color: string; image: string };
  fit?: string;
  images: [];
  transactionId: string;
  orderId: string;
};
type ReplyData = { _id: string; replyBy: string; reply: string; createdAt: Date };

type CustomResponseType<T> = {
  message: string;
  data: T | null;
  code: number;
};

/**
 * Verifies if user has purchased and received the product before allowing review
 */
const verifyPurchaseEligibility = async (
  userId: string, 
  productId: string
): Promise<{ eligible: boolean; transactionId?: string; orderId?: string; message?: string }> => {
  try {
    // Find completed orders by the user that contain this product
    const orders = await Order.find({
      user: new ObjectId(userId),
      isPaid: true,
      status: 'Completed',
      deliveryStatus: 'Delivered',
      'products.product': new ObjectId(productId),
    }).populate('transactionId');

    if (orders.length === 0) {
      return {
        eligible: false,
        message: 'You can only review products you have purchased and received',
      };
    }

    // Get the most recent eligible order
    const latestOrder = orders[0];
    
    // Verify transaction is completed
    if (!latestOrder.transactionId) {
      return {
        eligible: false,
        message: 'No valid payment found for this purchase',
      };
    }

    const transaction = await Transaction.findById(latestOrder.transactionId);
    if (!transaction || transaction.status !== 'completed') {
      return {
        eligible: false,
        message: 'Payment must be completed before reviewing',
      };
    }

    return {
      eligible: true,
      transactionId: (transaction._id as any).toString(),
      orderId: latestOrder._id.toString(),
    };
  } catch (error) {
    console.error('Error verifying purchase eligibility:', error);
    return {
      eligible: false,
      message: 'Unable to verify purchase eligibility',
    };
  }
};

/**
 * Creates a new review with purchase verification
 */

/**
 * Adds a like to a review by a specific user.
 * @param reviewId - The ID of the review to like.
 * @param userId - The ID of the user liking the review.
 */
const likeReview = async (reviewId: string, userId: string): Promise<CustomResponseType<void>> => {
  try {
    await Review.findByIdAndUpdate(reviewId, {
      $addToSet: { likes: new ObjectId(userId) },
    });
    return {
      message: 'Review liked successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Removes a like from a review by a specific user.
 * @param reviewId - The ID of the review to unlike.
 * @param userId - The ID of the user unliking the review.
 */
const unlikeReview = async (reviewId: string, userId: string): Promise<CustomResponseType<void>> => {
  try {
    await Review.findByIdAndUpdate(reviewId, {
      $pull: { likes: new ObjectId(userId) },
    });
    return {
      message: 'Review unliked successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Checks if a review is liked by a specific user.
 * @param reviewId - The ID of the review.
 * @param userId - The ID of the user.
 * @returns A boolean indicating if the review is liked by the user.
 */
const isLikedByUser = async (reviewId: string, userId: string): Promise<CustomResponseType<boolean>> => {
  try {
    const review = await Review.findById(reviewId, {
      likes: { $in: [new ObjectId(userId)] },
    });
    return {
      message: 'Review like status retrieved successfully',
      data: review ? true : false,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets the count of likes for a specific review.
 * @param reviewId - The ID of the review.
 * @returns The number of likes for the review.
 */
const getLikeCount = async (reviewId: string): Promise<CustomResponseType<number>> => {
  try {
    const result = await Review.aggregate([
      { $match: { _id: new ObjectId(reviewId) } },
      { $project: { likesCount: { $size: '$likes' } } },
    ]);
    return {
      message: 'Like count retrieved successfully',
      data: result.length > 0 ? result[0].likesCount : 0,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets all reviews for a specific product, including likes count, replies count, and if the user has liked the review.
 * @param productId - The ID of the product.
 * @param userId - (Optional) The ID of the user to check if they liked the review.
 * @returns An array of reviews with additional information.
 */
const getReviewsByProductId = async (
  productId: string,
  userId?: string
): Promise<CustomResponseType<(typeof Review)[]>> => {
  try {
    const reviews = await Review.aggregate([
      { $match: { product: new ObjectId(productId) } },
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
        $project: {
          _id: 1,
          reviewBy: {
            _id: '$reviewBy',
            name: '$userDetails.firstName' + ' ' + '$userDetails.lastName',
            image: '$userDetails.image',
          },
          review: 1,
          product: 1,
          createdAt: 1,
          updatedAt: 1,
          images: 1,
          size: 1,
          style: 1,
          fit: 1,
          likesCount: { $size: '$likes' },
          repliesCount: { $size: '$replies' },
          isLikedByUser: userId ? { $in: [new ObjectId(userId), '$likes'] } : false,
        },
      },
      { $sort: { createdAt: -1 } }, // Optional: Sort by creation date
    ]);
    return {
      message: 'Reviews retrieved successfully',
      data: reviews,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets all replies for a specific review, with pagination.
 * @param reviewId - The ID of the review.
 * @param page - The page number for pagination (default is 1).
 * @param limit - The maximum number of replies to return per page (default is 10).
 * @returns An array of replies for the review.
 */
const getRepliesByReviewId = async (
  reviewId: string,
  page: number = 1,
  limit: number = 10
): Promise<CustomResponseType<ReplyData[]>> => {
  try {
    const replies = await Review.aggregate([
      { $match: { _id: new ObjectId(reviewId) } },
      { $unwind: '$replies' },
      { $sort: { 'replies.createdAt': -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          foreignField: '_id',
          localField: '$replies.replyBy',
          from: 'user',
          as: '$userDetails',
        },
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          _id: '$replies._id',
          replyBy: {
            _id: '$replies.replyBy',
            name: '$userDetails.firstName' + ' ' + '$userDetails.lastName',
            image: '$userDetails.image',
          },
          reply: '$replies.reply',
          createdAt: '$replies.createdAt',
          updatedAt: '$replies.updatedAt',
        },
      },
    ]);
    return {
      message: 'Replies retrieved successfully',
      data: replies,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a reply from a specific review.
 * @param reviewId - The ID of the review.
 * @param replyId - The ID of the reply to delete.
 * @param replyBy - The ID of the user who posted the reply.
 */
const deleteReply = async (reviewId: string, replyId: string, replyBy: string): Promise<CustomResponseType<void>> => {
  try {
    await Review.findByIdAndUpdate(reviewId, {
      $pull: { replies: { _id: replyId, replyBy: new ObjectId(replyBy) } },
    });
    return {
      message: 'Reply deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Creates a new review with purchase verification
 */
const createReview = async (reviewData: IReview): Promise<CustomResponseType<ReviewType>> => {
  try {
    const { reviewBy, product, rating, review, title, size, style, fit, images } = reviewData;

    // Verify purchase eligibility
    const eligibility = await verifyPurchaseEligibility(reviewBy, product);
    if (!eligibility.eligible) {
      return {
        message: eligibility.message || 'Not eligible to review this product',
        data: null,
        code: 403,
      };
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      product: new ObjectId(product),
      reviewBy: new ObjectId(reviewBy),
    });

    if (existingReview) {
      return {
        message: 'You have already reviewed this product',
        data: null,
        code: 400,
      };
    }

    const newReview = new Review({
      product,
      reviewBy,
      rating,
      review,
      title,
      size,
      style,
      fit,
      images,
      transactionId: eligibility.transactionId,
      orderId: eligibility.orderId,
    });

    await newReview.save();
    await newReview.populate([
      { path: 'reviewBy', select: 'firstName lastName email' },
      { path: 'product', select: 'name slug images' }
    ]);

    // Track review creation for analytics
    if (newReview._id && product && reviewBy) {
      AnalyticsService.trackReviewCreated(newReview._id.toString(), product, reviewBy).catch(
        (err) => console.error('Failed to track review analytics:', err)
      );
    }

    return {
      message: 'Review created successfully',
      data: newReview,
      code: 201,
    };
  } catch (error) {
    console.error('Error creating review:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates an existing review.
 * @param reviewId - The ID of the review to update.
 * @param reviewData - The updated data for the review.
 */
const updateReview = async (
  reviewId: string,
  reviewData: Pick<IReview, 'review' | 'rating' | 'title'>
): Promise<CustomResponseType<IReview | null>> => {
  try {
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId, 
      { 
        ...reviewData,
        updatedAt: new Date(),
      },
      { new: true }
    ).populate([
      { path: 'reviewBy', select: 'firstName lastName email' },
      { path: 'product', select: 'name slug images' }
    ]);
    
    if (!updatedReview) {
      return {
        message: 'Review not found',
        data: null,
        code: 404,
      };
    }
    
    return {
      message: 'Review updated successfully',
      data: updatedReview as any,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating review:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a review.
 * @param reviewId - The ID of the review to delete.
 */
const deleteReview = async ({
  reviewId,
  reviewBy,
}: {
  reviewId: string;
  reviewBy: string;
}): Promise<CustomResponseType<void>> => {
  try {
    const deleteReview = await Review.deleteOne({ _id: reviewId, reviewBy });
    if (deleteReview.deletedCount === 0) {
      return {
        message: 'Review not found or not deleted',
        data: null,
        code: 404,
      };
    }
    await Reply.deleteMany({ review: reviewId });
    return {
      message: 'Review deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Get all reviews for one product with pagination.
 * This function retrieves paginated reviews for a specific product, including user details, likes count, and replies count.
 * @param productId - The ID of the product to retrieve reviews for.
 * @param page - The page number for pagination (default is 1).
 * @param limit - The maximum number of reviews to return per page (default is 10).
 * @returns A paginated array of reviews for the specified product.
 */
const allReviews = async (
  productId: string,
  page: number = 1,
  limit: number = 20,
  userId?: string,
): Promise<{
  message: string;
  data: IReview[] | null;
  code: number;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  try {
    // Get total count for pagination
    const totalCount = await Review.countDocuments({ product: new ObjectId(productId) });
    const totalPages = Math.ceil(totalCount / limit);

    const reviews = await Review.aggregate([
      { $match: { product: new ObjectId(productId) } },
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
        $project: {
          _id: 1,
          reviewBy: {
            _id: '$reviewBy',
            name: { $concat: ['$userDetails.firstName', ' ', '$userDetails.lastName'] },
            image: '$userDetails.image',
          },
          review: 1,
          rating: 1,
          product: 1,
          createdAt: 1,
          updatedAt: 1,
          images: 1,
          size: 1,
          style: 1,
          fit: 1,
          likesCount: { $size: '$likes' },
          repliesCount: { $size: '$replies' },
          isLikedByUser: userId ? { $in: [new ObjectId(userId), '$likes'] } : false,
        },
      },
      { $sort: { createdAt: -1 } }, // Sort by creation date in descending order
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);

    return {
      message: 'Reviews retrieved successfully',
      data: reviews,
      code: 200,
      meta: {
        page,
        limit,
        total: totalCount,
        totalPages,
      },
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Get all of a user reviews with pagination.
 * This function retrieves paginated reviews for a specific product, including user details, likes count, and replies count.
 * @param userId - The ID of the product to retrieve reviews for.
 * @param page - The page number for pagination (default is 1).
 * @param limit - The maximum number of reviews to return per page (default is 10).
 * @returns A paginated array of reviews for the specified product.
 */
const userReviews = async (
  userId: string,
  page: number = 1,
  limit: number = 10
): Promise<CustomResponseType<IReview[]>> => {
  try {
    const reviews = await Review.aggregate([
      { $match: { reviewBy: new ObjectId(userId) } },
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
        $project: {
          _id: 1,
          reviewBy: {
            _id: '$reviewBy',
            name: { $concat: ['$userDetails.firstName', ' ', '$userDetails.lastName'] },
            image: '$userDetails.image',
          },
          review: 1,
          rating: 1,
          product: 1,
          createdAt: 1,
          updatedAt: 1,
          images: 1,
          size: 1,
          style: 1,
          fit: 1,
          likesCount: { $size: '$likes' },
          repliesCount: { $size: '$replies' },
        },
      },
      { $sort: { createdAt: -1 } }, // Sort by creation date in descending order
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);

    return {
      message: 'Reviews retrieved successfully',
      data: reviews,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Get the single review of a user for a specific product.
 * This function retrieves the single review for a specific product made by a specific user.
 * @param userId - The ID of the user to retrieve the review for.
 * @param productId - The ID of the product to retrieve the review for.
 * @returns The review for the specified product by the user.
 */
const userReviewPerProduct = async ({
  userId,
  productId,
}: {
  userId: string;
  productId: string;
}): Promise<CustomResponseType<IReview | null>> => {
  try {
    const review = await Review.aggregate([
      { $match: { reviewBy: new ObjectId(userId), product: new ObjectId(productId) } },
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
        $project: {
          _id: 1,
          reviewBy: {
            _id: '$reviewBy',
            name: { $concat: ['$userDetails.firstName', ' ', '$userDetails.lastName'] },
            image: '$userDetails.image',
          },
          review: 1,
          rating: 1,
          product: 1,
          createdAt: 1,
          updatedAt: 1,
          images: 1,
          size: 1,
          style: 1,
          fit: 1,
          likesCount: { $size: '$likes' },
          repliesCount: { $size: '$replies' },
        },
      },
    ]);

    return {
      message: 'User review for product retrieved successfully',
      data: review.length > 0 ? review[0] : null,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

const ReviewService = {
  likeReview,
  unlikeReview,
  isLikedByUser,
  getLikeCount,
  getReviewsByProductId,
  getRepliesByReviewId,
  deleteReply,
  createReview,
  updateReview,
  deleteReview,
  allReviews,
  userReviews,
  userReviewPerProduct,
};

export default ReviewService;
// TODO: scaling issue of max likes and max replies allowed
