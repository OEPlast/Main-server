import { ObjectId } from 'mongodb';
import Review from '../../models/Review';

type ReplyData = { _id: string; replyBy: string; reply: string; createdAt: Date };

type CustomResponseType<T> = {
  message: string;
  data: T | null;
  code: number;
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
 * Adds a reply to a specific review.
 * @param reviewId - The ID of the review to reply to.
 * @param reply - The reply data including the user ID and the reply text.
 */
const addReply = async (
  reviewId: string,
  reply: { replyBy: string; reply: string }
): Promise<CustomResponseType<void>> => {
  try {
    await Review.findByIdAndUpdate(reviewId, {
      $push: { replies: { reply: reply.reply, replyBy: new ObjectId(reply.replyBy) } },
    });
    return {
      message: 'Reply added successfully',
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
    await Review.findByIdAndUpdate(reviewId, {
      $pull: { replies: { _id: replyId } },
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
      { $set: { 'replies.$.reply': updatedReply } }
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
const deleteReview = async ({ reviewId }: { reviewId: string }): Promise<CustomResponseType<void>> => {
  try {
    const deleteReview = await Review.deleteOne({ _id: reviewId });
    if (deleteReview.deletedCount === 0) {
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
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

const Admin_ReviewService = {
  getRepliesByReviewId,
  addReply,
  deleteReply,
  deleteReview,
  updateReply,
};

export default Admin_ReviewService;
// TODO: scaling issue of max likes and max replies allowed
