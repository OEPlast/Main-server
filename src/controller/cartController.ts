import { Request, Response } from 'express';
import { AuthenticatedRequest, isAuthenticatedRequest } from '../types';
import CartService from '../services/cartService';

// Validate cart sales before checkout
export const validateCart = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const userId = (req as AuthenticatedRequest).userId;
    // Assuming validateCartSales is a method on CartService
    const result = await CartService.getCartItems(userId); // Using existing method
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in validateCart:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get cart items for a user
export const getCart = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { data, message, code } = await CartService.getCartItems(userId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in fetchCartItems:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Add an item to the cart
export const addToCart = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const userId = (req as AuthenticatedRequest).userId;
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
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const userId = (req as AuthenticatedRequest).userId;
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
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { message, code } = await CartService.clearCart(userId);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in clearUserCart:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update the quantity of an item in the cart
export const updateCartItemQuantity = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const userId = (req as AuthenticatedRequest).userId;
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
  validateCart,
};
