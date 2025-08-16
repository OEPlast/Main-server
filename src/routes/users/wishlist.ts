import express from 'express';
import WishlistController from '@/controller/wishlistController';
import WishlistValidator from '@/validators/Wishlist';
import { authenticateUser } from '@/middleware/auth';

const router = express.Router();

router.post('/add', authenticateUser, WishlistValidator.addToWishlist, WishlistController.addToWishlist);
router.delete(
  '/remove/:id',
  authenticateUser,
  WishlistValidator.removeFromWishlist,
  WishlistController.removeFromWishlist
);
router.get('/all', authenticateUser, WishlistValidator.getAllWishlists, WishlistController.getAllWishlists);
router.get('/count', authenticateUser, WishlistController.getTotalWishlistCount);

export default router;
