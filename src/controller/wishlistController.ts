import WishlistService from '@/services/wishlist';
import { Request, Response } from 'express';
import { isAuthenticatedRequest } from '@/types';

// Add an item to the wishlist
const addToWishlist = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { product } = req.body;
    const user = req.userId;
    const { data, message, code } = await WishlistService.createWishlist({ product, user });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in addToWishlist:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove an item from the wishlist
const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const user = req.userId;
    const { data, message, code } = await WishlistService.deleteWishlist({ id, user });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in removeFromWishlist:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all wishlist items with pagination
const getAllWishlists = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { page = 1, limit = 50 } = req.query;
    const user = req.userId;
    const { data, message, code, meta } = await WishlistService.getAllWishlists({
      page: Number(page),
      limit: Number(limit),
      user,
    });
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getAllWishlists:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get total wishlist count
const getTotalWishlistCount = async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const user = req.userId;
    const { data, message, code } = await WishlistService.getTotalWishlistCount(user);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTotalWishlistCount:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const WishlistController = { addToWishlist, removeFromWishlist, getAllWishlists, getTotalWishlistCount };
export default WishlistController;
