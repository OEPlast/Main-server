import Cart, { CartType } from '../models/Cart';
import Product from '../models/Product';
import { CustomResponseType } from '../types';

type PopulatedProduct = {
  product: {
    name: string;
    price: number;
  };
  qty: number;
  price: number;
  attributes: { name: string; value: string }[];
};

// Define the populated cart type
type PopulatedCartType = Omit<CartType, 'products'> & {
  products: PopulatedProduct[];
};

/**
 * Fetches the cart items for a user.
 * @param userId - The ID of the user.
 */
const getCartItems = async (userId: string): Promise<CustomResponseType<PopulatedCartType>> => {
  try {
    const cartItems = (await Cart.findOne({ user: userId }).populate({
      path: 'products.product',
      select: 'name price',
    })) as unknown as PopulatedCartType;
    return {
      message: 'Cart items retrieved successfully',
      data: cartItems,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching cart items:', error);
    return {
      message: 'Failed to fetch cart items',
      data: null,
      code: 500,
    };
  }
};

/**
 * Adds an item to the cart.
 * @param userId - The ID of the user.
 * @param productId - The ID of the product.
 * @param qty - The quantity to add.
 * @param attributes - The attributes of the product.
 */
const addToCart = async (
  userId: string,
  productId: string,
  qty: number,
  attributes: { name: string; value: string }[]
): Promise<CustomResponseType<CartType>> => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    if (qty > product.stock) {
      return {
        message: 'Insufficient stock',
        data: null,
        code: 400,
      };
    }

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $push: { products: { product: productId, qty, price: product.price, attributes } } },
      { new: true }
    );
    return {
      message: 'Item added to cart successfully',
      data: cart,
      code: 200,
    };
  } catch (error) {
    console.error('Error adding item to cart:', error);
    return {
      message: 'Failed to add item to cart',
      data: null,
      code: 500,
    };
  }
};

/**
 * Clears the entire cart for a user.
 * @param userId - The ID of the user.
 */
const clearCart = async (userId: string): Promise<CustomResponseType> => {
  try {
    const cart = await Cart.findOneAndDelete({ user: userId });
    if (!cart) {
      return {
        message: 'Cart not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Cart cleared successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error clearing cart:', error);
    return {
      message: 'Failed to clear cart',
      data: null,
      code: 500,
    };
  }
};

/**
 * Removes an item from the cart.
 * @param userId - The ID of the user.
 * @param productId - The ID of the product to remove.
 */
const removeFromCart = async (userId: string, productId: string): Promise<CustomResponseType<CartType>> => {
  try {
    const cart = await Cart.findOneAndUpdate({ user: userId }, { $pull: { products: { product: productId } } });

    if (!cart) {
      return {
        message: 'Cart not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Item removed from cart successfully',
      data: cart,
      code: 200,
    };
  } catch (error) {
    console.error('Error removing item from cart:', error);
    return {
      message: 'Failed to remove item from cart',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates the quantity of an item in the cart.
 * @param userId - The ID of the user.
 * @param productId - The ID of the product to update.
 * @param qty - The new quantity.
 */
const updateCartItem = async (
  userId: string,
  productId: string,
  qty: number
): Promise<CustomResponseType<CartType>> => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: userId, 'products.product': productId },
      { $set: { 'products.$.qty': qty } },
      { new: true }
    );

    return {
      message: 'Cart item updated successfully',
      data: cart,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating cart item:', error);
    return {
      message: 'Failed to update cart item',
      data: null,
      code: 500,
    };
  }
};

const CartService = { getCartItems, addToCart, removeFromCart, clearCart, updateCartItem };
export default CartService;
