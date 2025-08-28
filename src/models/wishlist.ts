import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

const wishlistSchema = new mongoose.Schema(
  {
    product: {
      type: ObjectId,
      ref: 'Product',
    },
    user: {
      type: ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast pagination and user filtering
wishlistSchema.index({ user: 1, product: -1 }, { unique: true });

export type WishlistType = InferSchemaType<typeof wishlistSchema>;
const Wishlist = mongoose.model('wishlist', wishlistSchema);

export default Wishlist;
