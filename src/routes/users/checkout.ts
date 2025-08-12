import express from 'express';
import OrderController from '../../controller/orderController';
import OrderValidator from '../../validators/OrderValidator';
import { isAuthenticated } from '../../middleware/auth';

const router = express.Router();

// All checkout routes require authentication
router.use(isAuthenticated);

// Checkout - create order from cart
router.post('/', OrderValidator.validateOrderPlacement, OrderController.placeOrder);

// Checkout + initialize Paystack payment (returns payment URL)
router.post('/paystack', OrderValidator.validateOrderPlacement, OrderController.checkoutAndInitPayment);

export default router;
