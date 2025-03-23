import { ObjectId } from 'mongodb';
import Review, { ReviewType } from '../models/Review';
import Reply from '@/models/Reply';

type IReview = {
  product: string;
  reviewBy: string;
  rating: number;
  review: string;
  size?: string;
  style?: { color: string; image: string };
  fit?: string;
  images: [];
};
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
 * Creates a new review.
 * @param reviewData - The data for the new review.
 */
const createReview = async (reviewData: IReview): Promise<CustomResponseType<ReviewType>> => {
  try {
    //logic to check if user ordered a product

    const newReview = new Review(reviewData);
    await newReview.save();

    return {
      message: 'Review created successfully',
      data: newReview,
      code: 201,
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
 * Updates an existing review.
 * @param reviewId - The ID of the review to update.
 * @param reviewData - The updated data for the review.
 */
const updateReview = async (
  reviewId: string,
  reviewData: Pick<IReview, 'review' | 'rating'>
): Promise<CustomResponseType<IReview | null>> => {
  try {
    const updatedReview = await Review.findByIdAndUpdate(reviewId, reviewData);
    if (!updatedReview) {
      return {
        message: 'Review not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Review updated successfully',
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
  limit: number = 10
): Promise<CustomResponseType<IReview[]>> => {
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
            name: { $concat: ['$userDetails.firstname', ' ', '$userDetails.lastname'] },
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
            name: { $concat: ['$userDetails.firstname', ' ', '$userDetails.lastname'] },
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
            name: { $concat: ['$userDetails.firstname', ' ', '$userDetails.lastname'] },
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
