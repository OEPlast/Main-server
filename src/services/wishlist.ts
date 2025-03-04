import { ProductType } from '@/models/Product';
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
 * Retrieves a wishlist item by ID.
 * @param id - The ID of the wishlist item to retrieve.
 * @returns A promise that resolves to a custom response containing the wishlist item.
 */
const getWishlist = async (id: string): Promise<CustomResponseType<WishlistType>> => {
  try {
    const wishlist = await Wishlist.findById(id).populate('product user');
    if (!wishlist) {
      return {
        message: 'Wishlist item not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Wishlist item retrieved successfully',
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
 * @returns A promise that resolves to a custom response containing the wishlist items and total count.
 */
const getAllWishlists = async (
  page: number,
  limit: number = 50
): Promise<CustomResponseType<{ wishlists: ProductType[]; total: number }>> => {
  try {
    const skip = (page - 1) * limit;
    const wishlists = (await Wishlist.find().populate('product').skip(skip).limit(limit)) as unknown as ProductType[];
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
 * Deletes a wishlist item by ID.
 * @param id - The ID of the wishlist item to delete.
 * @returns A promise that resolves to a custom response indicating the result of the deletion.
 */
const deleteWishlist = async (id: string): Promise<CustomResponseType<null>> => {
  try {
    const wishlist = await Wishlist.findByIdAndDelete(id);
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

export { createWishlist, getWishlist, getAllWishlists, deleteWishlist, getTotalWishlistCount };
