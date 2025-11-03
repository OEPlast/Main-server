import Product from '@/models/Product';
import Wishlist, { WishlistType } from '../models/wishlist';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';

/**
 * Creates a new wishlist item.
 * @param product - The product ID to add to the wishlist.
 * @param user - The user ID who owns the wishlist.
 * @returns A promise that resolves to a custom response containing the created wishlist item.
 */
const createWishlist = async ({
  product,
  user,
}: {
  product: string;
  user: string;
}): Promise<CustomResponseType<WishlistType>> => {
  try {
    const productExist = await Product.findById(product).select('_id');

    if (!productExist) {
      return {
        message: 'Product does not exist',
        data: null,
        code: 404,
      };
    }
    await Wishlist.updateOne(
      { user: user, product: product },
      { $setOnInsert: { user: user, product: product } },
      { upsert: true }
    );
    // Return a consistent response even if it already existed
    return {
      message: 'Wishlist item created successfully',
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
 * Retrieves all wishlists for a specific user with pagination.
 *
 * @param {Object} params - The parameters for retrieving wishlists.
 * @param {string} params.user - The ID of the user whose wishlists are to be retrieved.
 * @param {number} params.page - The page number for pagination.
 * @param {number} [params.limit=50] - The number of wishlists to retrieve per page.
 * @returns {Promise<CustomResponseType<{ wishlists: ProductType[]; total: number }>>} - A promise that resolves to a custom response type containing the wishlists and the total count.
 */
const getAllWishlists = async ({
  page,
  limit = 50,
  user,
}: {
  user: string;
  page: number;
  limit: number;
}): Promise<
  CustomResponseTypeWithMeta<
    WishlistType[],
    { total: number; page: number; limit: number; pages: number; hasNext: boolean; hasPrev: boolean }
  >
> => {
  try {
    const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    const maxLimit = 100;
    const safeLimit = Math.max(1, Math.min(maxLimit, Number.isFinite(limit) ? Math.floor(limit) : 50));
    const skip = (safePage - 1) * safeLimit;

    const [rawItems, total] = await Promise.all([
      Wishlist.find({ user })
        .sort({ createdAt: -1 })
        .populate({
          path: 'product',
          select: '_id name price sku tags slug attributes description_images category',
          populate: { path: 'category', select: '_id name image slug' },
        })
        .skip(skip)
        .limit(safeLimit),
      Wishlist.countDocuments({ user }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const hasNext = safePage < totalPages;
    const hasPrev = safePage > 1;
    return {
      message: 'Wishlists retrieved successfully',
      data: rawItems,
      code: 200,
      meta: { total, page: safePage, limit: safeLimit, pages: totalPages, hasNext, hasPrev },
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
 * Deletes a wishlist item by ID and user.
 * @param id - The ID of the wishlist item to delete.
 * @param user - The user ID who owns the wishlist.
 * @returns A promise that resolves to a custom response indicating the result of the deletion.
 */
const deleteWishlist = async ({ id, user }: { id: string; user: string }): Promise<CustomResponseType<null>> => {
  try {
    const wishlist = await Wishlist.findOneAndDelete({ _id: id, user });
    if (!wishlist) {
      return {
        message: 'Wishlist item not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Wishlist item deleted successfully',
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
 * Retrieves the total count of wishlist items.
 * @returns A promise that resolves to a custom response containing the total count of wishlist items.
 */
const getTotalWishlistCount = async (userId: string): Promise<CustomResponseType<number>> => {
  try {
    const total = await Wishlist.countDocuments({ user: userId });
    return {
      message: 'Total wishlist count retrieved successfully',
      data: total,
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
const WishlistService = { createWishlist, getAllWishlists, deleteWishlist, getTotalWishlistCount };
export default WishlistService;
