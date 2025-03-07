import Product, { ProductType } from '@/models/Product';
import Wishlist, { WishlistType } from '../models/wishlist';
import { CustomResponseType } from '@/types';

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
    const wishlist = new Wishlist({ product, user });
    await wishlist.save();
    return {
      message: 'Wishlist item created successfully',
      data: wishlist,
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
 * Retrieves all wishlist items with pagination.
 * @param page - The page number to retrieve.
 * @param limit - The number of items per page (max 50).
 * @param user - User id.
 * @returns A promise that resolves to a custom response containing the wishlist items and total count.
 */
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
}): Promise<CustomResponseType<{ wishlists: ProductType[]; total: number }>> => {
  try {
    const skip = (page - 1) * limit;
    const wishlists = (await Wishlist.find({ user })
      .populate('product')
      .skip(skip)
      .limit(limit)) as unknown as ProductType[];
    // TODO: look into this above
    const total = await Wishlist.countDocuments();
    return {
      message: 'Wishlists retrieved successfully',
      data: { wishlists, total },
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
