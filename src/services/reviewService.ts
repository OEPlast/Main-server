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
      transactionId: transaction.id.toString(),
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
      { path: 'product', select: 'name slug images' },
    ]);

    // Track review creation for analytics
    if (newReview._id && product && reviewBy) {
      AnalyticsService.trackReviewCreated(newReview._id.toString(), product, reviewBy).catch((err) =>
        console.error('Failed to track review analytics:', err)
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
      { path: 'product', select: 'name slug images' },
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
      data: updatedReview.toObject() as unknown as IReview,
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
 * Get all reviews for one product with cursor pagination and filters.
 * This function retrieves paginated reviews for a specific product, including user details, likes count, and replies count.
 * @param productId - The ID of the product to retrieve reviews for.
 * @param cursor - Optional cursor for pagination (review ID to start from).
 * @param limit - The maximum number of reviews to return per page (default is 15).
 * @param userId - Optional user ID to check if they liked the review.
 * @param filters - Optional filters for rating, hasImages, and sortBy.
 * @returns A paginated array of reviews for the specified product.
 */
const allReviews = async (
  productId: string,
  cursor?: string,
  limit: number = 15,
  userId?: string,
  filters?: {
    rating?: number;
    hasImages?: boolean;
    sortBy?: 'newest' | 'helpful' | 'rating-high' | 'rating-low';
  }
): Promise<{
  message: string;
  data: IReview[] | null;
  code: number;
  meta?: {
    nextCursor: string | null;
    count: number;
  };
}> => {
  try {
    // Build match condition
    const matchCondition: Record<string, unknown> = { product: new ObjectId(productId) };

    // Apply cursor for pagination
    if (cursor) {
      matchCondition._id = { $gt: new ObjectId(cursor) };
    }

    // Apply rating filter
    if (filters?.rating) {
      matchCondition.rating = filters.rating;
    }

    // Apply hasImages filter
    if (filters?.hasImages) {
      matchCondition.images = { $exists: true, $ne: [], $type: 'array' };
    }

    // Determine sort order - default to newest (most recent first)
    let sortStage: Record<string, 1 | -1> = { createdAt: -1, _id: 1 }; // Default: newest first

    if (filters?.sortBy === 'helpful') {
      sortStage = { likesCount: -1, createdAt: -1, _id: 1 };
    } else if (filters?.sortBy === 'rating-high') {
      sortStage = { rating: -1, createdAt: -1, _id: 1 };
    } else if (filters?.sortBy === 'rating-low') {
      sortStage = { rating: 1, createdAt: -1, _id: 1 };
    } else if (filters?.sortBy === 'newest' || !filters?.sortBy) {
      sortStage = { createdAt: -1, _id: 1 }; // Newest first (default)
    }

    const reviews = await Review.aggregate([
      { $match: matchCondition },
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ['$likes', []] } },
          repliesCount: { $size: { $ifNull: ['$replies', []] } },
          isLikedByUser: userId ? { $in: [new ObjectId(userId), { $ifNull: ['$likes', []] }] } : false,
        },
      },
      { $sort: sortStage },
      { $limit: limit + 1 }, // Fetch one extra to check if there are more
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
            firstName: '$userDetails.firstName',
            lastName: '$userDetails.lastName',
            image: '$userDetails.image',
          },
          message: '$review',
          rating: 1,
          product: 1,
          createdAt: 1,
          updatedAt: 1,
          images: 1,
          size: 1,
          style: 1,
          fit: 1,
          likesCount: 1,
          repliesCount: 1,
          isLikedByUser: 1,
          title: 1,
          transactionId: 1,
        },
      },
    ]);

    // Check if there are more results
    const hasMore = reviews.length > limit;
    const data = hasMore ? reviews.slice(0, limit) : reviews;

    // Get next cursor (last item's ID) - null indicates no more results
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]._id.toString() : null;

    return {
      message: 'Reviews retrieved successfully',
      data,
      code: 200,
      meta: {
        nextCursor,
        count: data.length,
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
 * Get reviews of a user for a specific product with cursor pagination.
 * This function retrieves reviews for a specific product made by a specific user.
 * @param userId - The ID of the user to retrieve the reviews for.
 * @param productId - The ID of the product to retrieve the reviews for.
 * @param cursor - Optional cursor for pagination (review ID to start from).
 * @param limit - Number of reviews per page (default: 15).
 * @returns Paginated reviews for the specified product by the user.
 */
const userReviewPerProduct = async ({
  userId,
  productId,
  cursor,
  limit = 15,
}: {
  userId: string;
  productId: string;
  cursor?: string;
  limit?: number;
}): Promise<CustomResponseType<IReview[]> & { meta?: { nextCursor: string | null; count: number } }> => {
  try {
    // Build match condition with cursor for pagination
    const matchCondition: Record<string, unknown> = {
      reviewBy: new ObjectId(userId),
      product: new ObjectId(productId),
    };

    // If cursor provided, get reviews after this ID
    if (cursor) {
      matchCondition._id = { $gt: new ObjectId(cursor) };
    }

    const reviews = await Review.aggregate([
      { $match: matchCondition },
      { $sort: { _id: 1 } }, // Sort by ID for consistent cursor pagination
      { $limit: limit + 1 }, // Fetch one extra to check if there are more
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
            firstName: '$userDetails.firstName',
            lastName: '$userDetails.lastName',
            image: '$userDetails.image',
          },
          message: '$review',
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
          title: 1,
          transactionId: 1,
        },
      },
    ]);

    // Check if there are more results
    const hasMore = reviews.length > limit;
    const data = hasMore ? reviews.slice(0, limit) : reviews;

    // Get next cursor (last item's ID) - null indicates no more results
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]._id.toString() : null;

    return {
      message: 'User reviews for product retrieved successfully',
      data,
      code: 200,
      meta: {
        nextCursor,
        count: data.length,
      },
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: [],
      code: 500,
    };
  }
};

/**
 * Get review statistics for a product
 * Returns total ratings, average rating, and star distribution
 * @param productId - The ID of the product
 * @returns Review statistics
 */
const getProductReviewStats = async (
  productId: string
): Promise<
  CustomResponseType<{
    totalRatings: number;
    averageRating: number;
    starDistribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  }>
> => {
  try {
    const stats = await Review.aggregate([
      { $match: { product: new ObjectId(productId) } },
      {
        $facet: {
          totalAndAverage: [
            {
              $group: {
                _id: null,
                totalRatings: { $sum: 1 },
                averageRating: { $avg: '$rating' },
              },
            },
          ],
          starDistribution: [
            {
              $group: {
                _id: '$rating',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const totalAndAverage = stats[0].totalAndAverage[0] || { totalRatings: 0, averageRating: 0 };
    const starDistributionArray = stats[0].starDistribution || [];

    // Initialize star distribution with zeros
    const starDistribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    // Fill in actual counts from database
    starDistributionArray.forEach((item: { _id: number; count: number }) => {
      if (item._id >= 1 && item._id <= 5) {
        starDistribution[item._id as keyof typeof starDistribution] = item.count;
      }
    });

    return {
      message: 'Review statistics retrieved successfully',
      data: {
        totalRatings: totalAndAverage.totalRatings,
        averageRating: Math.round(totalAndAverage.averageRating * 10) / 10, // Round to 1 decimal
        starDistribution,
      },
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: {
        totalRatings: 0,
        averageRating: 0,
        starDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
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
  getProductReviewStats,
  verifyPurchaseEligibility,
};

export default ReviewService;
// TODO: scaling issue of max likes and max replies allowed
