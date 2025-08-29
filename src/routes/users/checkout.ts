import express from 'express';
import OrderController from '../../controller/orderController';
import OrderValidator from '../../validators/OrderValidator';
import { authenticateUser } from '../../middleware/auth';

const router = express.Router();

// All checkout routes require authentication
router.use(authenticateUser);

// Calculate shipping cost for checkout preview (supports both shipping and pickup)
router.post('/calculate-shipping', OrderValidator.validateShippingCalculation, OrderController.calculateShipping);

// Secure checkout with comprehensive price validation (supports delivery types)
router.post('/secure', OrderValidator.validateSecureCheckout, OrderController.secureCheckout);

export default router;
