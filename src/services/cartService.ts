import Cart from '../models/Cart';
import Product from '../models/Product';
import { CustomResponseType } from '../types';

/**
 * Fetches the cart items for a user.
 * @param userId - The ID of the user.
 */
const getCartItems = async (userId: string): Promise<CustomResponseType<any>> => {
  try {
    const cartItems = await Cart.find({ user: userId }).populate('products.product');
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
 */
const addToCart = async (userId: string, productId: string, qty: number): Promise<CustomResponseType<any>> => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    const totalStock = product.subProducts.reduce(
      (total, subProduct) => total + subProduct.sizes.reduce((sum, size) => sum + size.qty, 0),
      0
    );
    if (qty > totalStock) {
      return {
        message: 'Insufficient stock',
        data: null,
        code: 400,
      };
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      const newCart = new Cart({ user: userId, products: [{ product: productId, qty }] });
      await newCart.save();
      return {
        message: 'Item added to cart successfully',
        data: newCart,
        code: 201,
      };
    }

    const existingProduct = cart.products.find((item) => item.product.toString() === productId);
    if (existingProduct) {
      existingProduct.qty += qty;
    } else {
      cart.products.push({ product: productId, qty });
    }

    await cart.save();
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

const CartService = { getCartItems, addToCart };
export default CartService;
