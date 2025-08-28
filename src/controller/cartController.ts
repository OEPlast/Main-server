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
    const result = await CartService.validateCartSales(userId);
    return res.status(result.valid ? 200 : 409).json(result);
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
    const userId = req.userId;
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
    const { itemId } = req.params;
    const { data, message, code } = await CartService.removeFromCart(userId, itemId);
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

// Update a cart item
export const updateCartItem = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { itemId } = req.params;
    const { qty, selectedAttributes } = req.body;
    const { message, data, code } = await CartService.updateCartItem(userId, itemId, {
      qty,
      selectedAttributes,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateCartItem:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Apply coupon to cart
export const applyCoupon = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { couponCode } = req.body;
    const { message, data, code } = await CartService.applyCoupon(userId, couponCode);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in applyCoupon:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove coupon from cart
export const removeCoupon = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { couponId } = req.params;
    const { message, data, code } = await CartService.removeCoupon(userId, couponId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in removeCoupon:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getCart,
  addToCart,
  removeFromCart,
  clearUserCart,
  updateCartItem,
  validateCart,
  applyCoupon,
  removeCoupon,
};
