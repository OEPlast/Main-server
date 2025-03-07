import express from 'express';
import WishlistController from '@/controller/wishlistController';
import WishlistValidator from '@/validators/Wishlist';
import { isAuthenticated } from '@/middleware/auth';

const router = express.Router();

router.post('/add', isAuthenticated, WishlistValidator.addToWishlist, WishlistController.addToWishlist);
router.delete(
  '/remove/:id',
  isAuthenticated,
  WishlistValidator.removeFromWishlist,
  WishlistController.removeFromWishlist
);
router.get('/all', isAuthenticated, WishlistValidator.getAllWishlists, WishlistController.getAllWishlists);
router.get('/count', isAuthenticated, WishlistController.getTotalWishlistCount);

export default router;
