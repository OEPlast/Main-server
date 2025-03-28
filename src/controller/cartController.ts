import { Request, Response } from 'express';
import CartService from '../services/cartService';

// Get cart items for a user
export const getCart = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { data, message, code } = await CartService.getCartItems(userId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in fetchCartItems:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Add an item to the cart
export const addToCart = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { productId, qty, attributes } = req.body;
    const { data, message, code } = await CartService.addToCart(userId, productId, qty, attributes);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in addItemToCart:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove an item from the cart
export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { productId } = req.params;
    const { data, message, code } = await CartService.removeFromCart(userId, productId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in removeFromCart:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Clear the cart for a user
export const clearUserCart = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { message, code } = await CartService.clearCart(userId);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in clearUserCart:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update the quantity of an item in the cart
export const updateCartItemQuantity = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { productId, qty } = req.body;
    const { message, data, code } = await CartService.updateCartItem(userId, productId, qty);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateCartItemQuantity:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getCart,
  addToCart,
  removeFromCart,
  clearUserCart,
  updateCartItemQuantity,
};
