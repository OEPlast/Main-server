import express from 'express';
import CartController from '../../controller/cartController';
import CartValidator from '../../validators/CartValidator';
import { authenticateUser } from '@/middleware/auth';

const router = express.Router();
router.use(authenticateUser);

// Get cart items
router.get('/', CartController.getCart);

// Add item to cart (creates cart if doesn't exist)
router.post('/add', CartValidator.addToCart, CartController.addToCart);

// Clear entire cart (deletes cart document)
router.delete('/clear', CartController.clearUserCart);

// Update specific cart item by itemId
router.put('/item/:itemId', CartValidator.updateCartItem, CartController.updateCartItem);

// Remove specific cart item by itemId
router.delete('/item/:itemId', CartValidator.removeItem, CartController.removeFromCart);

// Validate cart sales before checkout
router.get('/validate-sales', CartController.validateCart);

// Apply coupon to cart
router.post('/coupon', CartValidator.applyCoupon, CartController.applyCoupon);

// Remove coupon from cart
router.delete('/coupon/:couponId', CartValidator.removeCoupon, CartController.removeCoupon);

export default router;
