import express from 'express';
import CartController from '../../controller/cartController';
import CartValidator from '../../validators/CartValidator';

const router = express.Router();

router.get('/', CartController.getCart);
router.post('/add', CartValidator.addToCart, CartController.addToCart);
router.post('/clear', CartController.clearUserCart);
router.put('/update/:id', CartValidator.updateCartItem, CartController.updateCartItemQuantity);
router.patch('/remove/:id', CartController.removeFromCart);
// Validate cart sales before checkout
router.get('/validate-sales', CartController.validateCart);

export default router;
