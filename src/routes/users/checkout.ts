import express from 'express';
import OrderController from '../../controller/orderController';
import OrderValidator from '../../validators/OrderValidator';
import { authenticateUserIfTokenSent } from '../../middleware/auth';
import RateLimits from '../../middleware/rate';

const router = express.Router();

// Checkout is open to guests. No token: the request carries a `guest` contact block instead (see
// OrderValidator / CheckoutCustomerService). A token that is sent must still be valid — an expired
// one is a 401, not a silent switch to guest checkout. The limiter only counts guest requests, so
// it must come after the optional auth.
router.use(authenticateUserIfTokenSent, RateLimits.GuestCheckout_Limiter);

// Calculate shipping cost for checkout preview (supports both shipping and pickup)
router.post('/calculate-shipping', OrderValidator.validateShippingCalculation, OrderController.calculateShipping);

// Secure checkout with comprehensive price validation (supports delivery types)
router.post('/secure', OrderValidator.validateSecureCheckout, OrderController.secureCheckout);

export default router;
