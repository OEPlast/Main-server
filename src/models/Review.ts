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
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 1000,
    },
    title: {
      type: String,
      maxlength: 100,
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
    // Transaction that verifies purchase
    transactionId: {
      type: ObjectId,
      ref: 'Transaction',
      required: true,
    },
    // Order that contains the product
    orderId: {
      type: ObjectId,
      ref: 'Order',
      required: true,
    },
    // Helpfulness tracking
    helpfulVotes: {
      helpful: [{
        type: ObjectId,
        ref: 'User',
      }],
      notHelpful: [{
        type: ObjectId,
        ref: 'User',
      }],
    },
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
          required: true,
        },
        replyBy: {
          type: ObjectId,
          ref: 'User',
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Admin moderation
    isApproved: {
      type: Boolean,
      default: true,
    },
    moderatedBy: {
      type: ObjectId,
      ref: 'User',
    },
    moderatedAt: {
      type: Date,
    },
    moderationNote: {
      type: String,
    },
  },
  { timestamps: true }
);

// Add indexes for efficient querying
reviewSchema.index({ product: 1, reviewBy: 1 }, { unique: true }); // One review per product per user
reviewSchema.index({ product: 1 });
reviewSchema.index({ reviewBy: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ isApproved: 1 });
reviewSchema.index({ transactionId: 1 });
reviewSchema.index({ orderId: 1 });

export type ReviewType = InferSchemaType<typeof reviewSchema>;
const Review = mongoose.model('Review', reviewSchema);

export default Review;
