import { ObjectId } from 'mongodb';
import Review, { ReviewType } from '../../models/Review';
import User from '../../models/User';
import Product from '../../models/Product';
import mongoose from 'mongoose';

type ReplyData = { _id: string; replyBy: string; reply: string; createdAt: Date };

type CustomResponseType<T> = {
  message: string;
  data: T | null;
  code: number;
};

type CustomResponseTypeWithMeta<T, M = undefined> = {
  message: string;
  data: T | null;
  code: number;
  meta?: M;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ReviewFilters = {
  page?: number;
  limit?: number;
  rating?: number;
  isApproved?: boolean;
  productId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'rating' | 'helpful';
  sortOrder?: 'asc' | 'desc';
};

type MoodAnalysisFilters = {
  startDate: string;
  endDate: string;
  productId?: string;
  categoryId?: string;
};

type DailyMoodData = {
  date: string;
  ratings: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  averageRating: number;
  totalReviews: number;
  moodScore: number; // Calculated mood based on rating distribution
};

/**
 * Gets all reviews with pagination and filtering for admin dashboard
 */
const getAllReviews = async (
  filters: ReviewFilters
): Promise<CustomResponseTypeWithMeta<ReviewType[], PaginationMeta>> => {
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
      sortOrder = 'desc',
    } = filters;

    // Build match conditions
    const matchConditions: Record<string, unknown> = {};

    if (rating) matchConditions.rating = rating;
    if (typeof isApproved === 'boolean') matchConditions.isApproved = isApproved;
    if (productId) matchConditions.product = new mongoose.Types.ObjectId(productId);
    if (userId) matchConditions.reviewBy = new mongoose.Types.ObjectId(userId);

    if (startDate || endDate) {
      matchConditions.createdAt = {} as { $gte?: Date; $lte?: Date };
      if (startDate) (matchConditions.createdAt as { $gte?: Date; $lte?: Date })['$gte'] = new Date(startDate);
      if (endDate) (matchConditions.createdAt as { $gte?: Date; $lte?: Date })['$lte'] = new Date(endDate);
    }

    // Build sort conditions
    const sortConditions: Record<string, 1 | -1> = {};
    sortConditions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Count total reviews
    const total = await Review.countDocuments(matchConditions);
    const totalPages = Math.ceil(total / limit);

    // Get reviews with pagination
    const reviews = await Review.find(matchConditions)
      .populate('reviewBy', 'firstName lastName email')
      .populate('product', 'name slug images')
      .populate('transactionId', 'reference status')
      .populate('orderId', 'orderNumber status')
      .sort(sortConditions)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      message: 'Reviews retrieved successfully',
      data: reviews as ReviewType[],
      code: 200,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    console.error('Error getting all reviews:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets a single review by ID with full details
 */
const getReviewById = async (reviewId: string): Promise<CustomResponseType<ReviewType>> => {
  try {
    const review = await Review.findById(reviewId)
      .populate('reviewBy', 'firstName lastName email phoneNumber')
      .populate('product', 'name slug images price')
      .populate('transactionId', 'reference status amount paidAt')
      .populate('orderId', 'orderNumber status deliveryStatus deliveredAt')
      .populate('moderatedBy', 'firstName lastName email')
      .populate('replies.replyBy', 'firstName lastName email')
      .lean();

    if (!review) {
      return {
        message: 'Review not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Review retrieved successfully',
      data: review as ReviewType,
      code: 200,
    };
  } catch (error) {
    console.error('Error getting review by ID:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets reviews by product ID with pagination and filtering
 */
const getReviewsByProductId = async (
  productId: string,
  filters: Omit<ReviewFilters, 'productId'>
): Promise<CustomResponseTypeWithMeta<ReviewType[], PaginationMeta>> => {
  try {
    return await getAllReviews({ ...filters, productId });
  } catch (error) {
    console.error('Error getting reviews by product ID:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets reviews by user ID with pagination and filtering
 */
const getReviewsByUserId = async (
  userId: string,
  filters: Omit<ReviewFilters, 'userId'>
): Promise<CustomResponseTypeWithMeta<ReviewType[], PaginationMeta>> => {
  try {
    return await getAllReviews({ ...filters, userId });
  } catch (error) {
    console.error('Error getting reviews by user ID:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Moderates a review (approve/reject)
 */
const moderateReview = async (
  reviewId: string,
  adminId: string,
  isApproved: boolean,
  moderationNote?: string
): Promise<CustomResponseType<ReviewType>> => {
  try {
    const review = await Review.findByIdAndUpdate(
      reviewId,
      {
        isApproved,
        moderatedBy: new ObjectId(adminId),
        moderatedAt: new Date(),
        ...(moderationNote && { moderationNote }),
      },
      { new: true }
    )
      .populate('reviewBy', 'firstName lastName email')
      .populate('product', 'name slug')
      .populate('moderatedBy', 'firstName lastName email');

    if (!review) {
      return {
        message: 'Review not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: `Review ${isApproved ? 'approved' : 'rejected'} successfully`,
      data: review as ReviewType,
      code: 200,
    };
  } catch (error) {
    console.error('Error moderating review:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates a review (admin can edit content)
 */
const updateReview = async (
  reviewId: string,
  adminId: string,
  updateData: {
    review?: string;
    rating?: number;
    title?: string;
    moderationNote?: string;
  }
): Promise<CustomResponseType<ReviewType>> => {
  try {
    const review = await Review.findByIdAndUpdate(
      reviewId,
      {
        ...updateData,
        updatedAt: new Date(),
        moderatedBy: new ObjectId(adminId),
        moderatedAt: new Date(),
      },
      { new: true }
    )
      .populate('reviewBy', 'firstName lastName email')
      .populate('product', 'name slug')
      .populate('moderatedBy', 'firstName lastName email');

    if (!review) {
      return {
        message: 'Review not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Review updated successfully',
      data: review as ReviewType,
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
 * Gets mood analysis based on reviews within date ranges
 */
const getMoodBasedAnalysis = async (filters: MoodAnalysisFilters): Promise<CustomResponseType<DailyMoodData[]>> => {
  try {
    const { startDate, endDate, productId, categoryId } = filters;

    // Build match conditions
    const matchConditions: Record<string, unknown> = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
      isApproved: true,
    };

    if (productId) {
      matchConditions.product = new ObjectId(productId);
    }

    // If categoryId is provided, we need to join with products to filter by category
    const aggregationPipeline: any[] = [{ $match: matchConditions }];

    if (categoryId) {
      aggregationPipeline.push(
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productData',
          },
        },
        {
          $match: {
            'productData.category': new ObjectId(categoryId),
          },
        }
      );
    }

    aggregationPipeline.push(
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          ratings: {
            $push: '$rating',
          },
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
      {
        $project: {
          date: '$_id',
          totalReviews: 1,
          averageRating: { $round: ['$averageRating', 2] },
          ratings: {
            1: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 1] },
                },
              },
            },
            2: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 2] },
                },
              },
            },
            3: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 3] },
                },
              },
            },
            4: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 4] },
                },
              },
            },
            5: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 5] },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          // Calculate mood score: weighted average where 5-star = very positive, 1-star = very negative
          moodScore: {
            $round: [
              {
                $divide: [
                  {
                    $add: [
                      { $multiply: ['$ratings.1', 1] },
                      { $multiply: ['$ratings.2', 2] },
                      { $multiply: ['$ratings.3', 3] },
                      { $multiply: ['$ratings.4', 4] },
                      { $multiply: ['$ratings.5', 5] },
                    ],
                  },
                  '$totalReviews',
                ],
              },
              2,
            ],
          },
        },
      },
      {
        $sort: { date: 1 },
      }
    );

    const moodAnalysis = await Review.aggregate(aggregationPipeline);

    return {
      message: 'Mood analysis retrieved successfully',
      data: moodAnalysis as DailyMoodData[],
      code: 200,
    };
  } catch (error) {
    console.error('Error getting mood analysis:', error);
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
          localField: 'replies.replyBy',
          from: 'users',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          _id: '$replies._id',
          replyBy: {
            _id: '$replies.replyBy',
            name: { $concat: ['$userDetails.firstName', ' ', '$userDetails.lastName'] },
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
    console.error('Error getting replies:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Adds a reply to a specific review.
 * @param reviewId - The ID of the review to reply to.
 * @param replyText - The reply text.
 * @param adminId - The ID of the admin adding the reply.
 */
const addReply = async (reviewId: string, replyText: string, adminId?: string): Promise<CustomResponseType<void>> => {
  try {
    const replyBy = adminId || new ObjectId(); // Use admin ID if provided, otherwise generate new ObjectId

    await Review.findByIdAndUpdate(reviewId, {
      $push: {
        replies: {
          reply: replyText,
          replyBy: new ObjectId(replyBy),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    });

    return {
      message: 'Reply added successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error adding reply:', error);
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
 */
const deleteReply = async ({
  reviewId,
  replyId,
}: {
  reviewId: string;
  replyId: string;
}): Promise<CustomResponseType<void>> => {
  try {
    const result = await Review.findByIdAndUpdate(reviewId, {
      $pull: { replies: { _id: replyId } },
    });

    if (!result) {
      return {
        message: 'Review or reply not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Reply deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting reply:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates a reply in a specific review.
 * @param reviewId - The ID of the review.
 * @param replyId - The ID of the reply to update.
 * @param updatedReply - The updated reply text.
 */
const updateReply = async ({
  reviewId,
  replyId,
  updatedReply,
}: {
  reviewId: string;
  replyId: string;
  updatedReply: string;
}): Promise<CustomResponseType<void>> => {
  try {
    const result = await Review.findOneAndUpdate(
      { _id: reviewId, 'replies._id': replyId },
      {
        $set: {
          'replies.$.reply': updatedReply,
          'replies.$.updatedAt': new Date(),
        },
      }
    );

    if (!result) {
      return {
        message: 'Reply not found or not updated',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Reply updated successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating reply:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a review (admin can delete any review).
 * @param reviewId - The ID of the review to delete.
 */
const deleteReview = async ({ reviewId }: { reviewId: string }): Promise<CustomResponseType<void>> => {
  try {
    const deleteResult = await Review.deleteOne({ _id: reviewId });

    if (deleteResult.deletedCount === 0) {
      return {
        message: 'Review not found or not deleted',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Review deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting review:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Get review statistics
 */
const getStatistics = async (): Promise<CustomResponseType<any>> => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run aggregations in parallel
    const [total, approved, pending, rejected, withReplies, withImages, ratingStats, recentReviews, helpfulVotesStats] =
      await Promise.all([
        // Total reviews
        Review.countDocuments(),

        // Approved reviews
        Review.countDocuments({ isApproved: true }),

        // Pending reviews (not approved and not rejected)
        Review.countDocuments({ isApproved: { $ne: true }, isRejected: { $ne: true } }),

        // Rejected reviews
        Review.countDocuments({ isRejected: true }),

        // Reviews with replies
        Review.countDocuments({ 'replies.0': { $exists: true } }),

        // Reviews with images
        Review.countDocuments({ images: { $exists: true, $ne: [] } }),

        // Rating distribution and average
        Review.aggregate([
          {
            $group: {
              _id: null,
              averageRating: { $avg: '$rating' },
              rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
              rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
              rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
              rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
              rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            },
          },
        ]),

        // Recent reviews (last 7 days)
        Review.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),

        // Total helpful votes
        Review.aggregate([
          {
            $project: {
              helpfulCount: { $size: { $ifNull: ['$helpfulVotes.helpful', []] } },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$helpfulCount' },
            },
          },
        ]),
      ]);

    const ratingData = ratingStats[0] || {
      averageRating: 0,
      rating1: 0,
      rating2: 0,
      rating3: 0,
      rating4: 0,
      rating5: 0,
    };

    const helpfulVotesData = helpfulVotesStats[0] || { total: 0 };

    const statistics = {
      total,
      approved,
      pending,
      rejected,
      withReplies,
      withImages,
      averageRating: Number(ratingData.averageRating.toFixed(2)),
      ratingDistribution: {
        1: ratingData.rating1,
        2: ratingData.rating2,
        3: ratingData.rating3,
        4: ratingData.rating4,
        5: ratingData.rating5,
      },
      recentReviews,
      totalHelpfulVotes: helpfulVotesData.total,
    };

    return {
      message: 'Review statistics fetched successfully',
      data: statistics,
      code: 200,
    };
  } catch (error) {
    console.error('Error getting review statistics:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

const Admin_ReviewService = {
  getAllReviews,
  getReviewById,
  getReviewsByProductId,
  getReviewsByUserId,
  moderateReview,
  updateReview,
  getMoodBasedAnalysis,
  getStatistics,
  getRepliesByReviewId,
  addReply,
  deleteReply,
  updateReply,
  deleteReview,
};

export default Admin_ReviewService;
