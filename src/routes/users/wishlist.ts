import express from 'express';
import { getWishlist, addToWishlist, removeFromWishlist } from '../../controller/wishlistController';

const router = express.Router();

router.get('/wishlist', getWishlist);
router.post('/wishlist', addToWishlist);
router.delete('/wishlist/:id', removeFromWishlist);

export default router;
