import { ObjectId } from 'mongodb';
import Review from '../models/Review';
import { ObjectId as ObjectIdType } from 'mongoose';

type ReplyData = { _id: string; replyBy: string; reply: string; createdAt: Date };

type CustomResponseType<T> = {
  message: string;
  data: T | null;
  code: number;
};

/**
 * Adds a like to a review by a specific user.
 * @param reviewId - The ID of the review to like.
 * @param userId - The ID of the user liking the review.
 */
const likeReview = async (reviewId: string, userId: ObjectIdType): Promise<CustomResponseType<void>> => {
  try {
    await Review.findByIdAndUpdate(reviewId, {
      $addToSet: { likes: userId },
    });
    return {
      message: 'Review liked successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
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
const unlikeReview = async (reviewId: string, userId: ObjectIdType): Promise<CustomResponseType<void>> => {
  try {
    await Review.findByIdAndUpdate(reviewId, {
      $pull: { likes: userId },
    });
    return {
      message: 'Review unliked successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
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
const isLikedByUser = async (reviewId: string, userId: ObjectIdType): Promise<CustomResponseType<boolean>> => {
  try {
    const review = await Review.findById(reviewId, {
      likes: { $in: [userId] },
    });
    return {
      message: 'Review like status retrieved successfully',
      data: review ? true : false,
      code: 200,
    };
  } catch (error) {
    console.log(error);
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
    console.log(error);
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
            name: '$userDetails.firstname' + ' ' + '$userDetails.lastname',
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
    console.log(error);
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
            name: '$userDetails.firstname' + ' ' + '$userDetails.lastname',
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
    console.log(error);
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
 * @param reply - The reply data including the user ID and the reply text.
 */
const addReply = async (
  reviewId: string,
  reply: { replyBy: ObjectIdType; reply: string }
): Promise<CustomResponseType<void>> => {
  try {
    await Review.findByIdAndUpdate(reviewId, {
      $push: { replies: reply },
    });
    return {
      message: 'Reply added successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
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
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

export const ReviewService = {
  likeReview,
  unlikeReview,
  isLikedByUser,
  getLikeCount,
  getReviewsByProductId,
  getRepliesByReviewId,
  addReply,
  deleteReply,
};

// TODO: scaling issue of max likes and max replies allowed
