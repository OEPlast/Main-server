import express from 'express';
import { getCart, addToCart, updateCart, removeFromCart } from '../../controller/cartController';

const router = express.Router();

router.get('/cart', getCart);
router.post('/cart', addToCart);
router.put('/cart/:id', updateCart);
router.delete('/cart/:id', removeFromCart);

export default router;
