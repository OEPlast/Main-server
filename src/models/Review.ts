import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema;

const replySchema = new mongoose.Schema({
  replyBy: {
    type: ObjectId,
    ref: 'User',
    required: true,
  },
  reply: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

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
    replies: [replySchema],
  },
  { timestamps: true }
);

const Review = mongoose.model('Review', reviewSchema);

export default Review;
