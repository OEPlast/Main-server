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

export type WishlistType = InferSchemaType<typeof wishlistSchema>;
const Wishlist = mongoose.model('wishlist', wishlistSchema);

export default Wishlist;
