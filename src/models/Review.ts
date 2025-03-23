import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: ObjectId,
      ref: 'Product',
      required: true,
    },
    reviewBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      default: 0,
    },
    review: {
      type: String,
      required: true,
    },
    size: {
      type: String,
    },
    style: {
      color: String,
      image: String,
    },
    fit: {
      type: String,
    },
    images: [],
    likes: [
      {
        type: ObjectId,
        ref: 'User',
      },
    ],
    replies: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        reply: {
          type: String,
        },
        replyBy: {
          type: ObjectId,
          ref: 'User',
        },
      },
    ],
  },
  { timestamps: true }
);

export type ReviewType = InferSchemaType<typeof reviewSchema>;
const Review = mongoose.model('Review', reviewSchema);

export default Review;
