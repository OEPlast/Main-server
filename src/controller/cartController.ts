import { Request, Response } from 'express';
import { getCartItems, addToCart } from '../services/cartService';

// Get cart items for a user
export const fetchCartItems = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { data, message, code } = await getCartItems(userId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in fetchCartItems:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Add an item to the cart
export const addItemToCart = async (req: Request, res: Response) => {
  try {
    const cartData = req.body;
    const { data, message, code } = await addToCart(cartData);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in addItemToCart:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update an item in the cart
const updateCart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Logic to update an item in the cart
    res.status(200).json({ message: 'Cart item updated successfully' });
  } catch (error) {
    console.error('Error in updateCart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove an item from the cart
const removeFromCart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Logic to remove an item from the cart
    res.status(200).json({ message: 'Item removed from cart successfully' });
  } catch (error) {
    console.error('Error in removeFromCart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { fetchCartItems, addItemToCart, updateCart, removeFromCart };
