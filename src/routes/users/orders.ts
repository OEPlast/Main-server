//user order route
import express from 'express';
import OrderController from '../../controller/orderController';
import OrderValidator from '../../validators/OrderValidator';
import { authenticateUser } from '@/middleware/auth';

const router = express.Router();

// Fetch user orders
router.get('/orders', authenticateUser, OrderController.getOrders);

// Place a new order (secure checkout with comprehensive validation)
router.post('/orders/secure-checkout', authenticateUser, OrderValidator.validateSecureCheckout, OrderController.secureCheckout);

// Get order by ID
router.get('/orders/:id', authenticateUser, OrderValidator.validateOrderId, OrderController.getOrderById);

// Update an order
router.put('/orders/:id', authenticateUser, OrderValidator.validateOrderId, OrderController.updateOrder);

// Cancel an order
router.delete('/orders/:id', authenticateUser, OrderValidator.validateOrderId, OrderController.cancelOrder);

// Initiate a return for an order
router.post('/orders/:id/return', authenticateUser, OrderValidator.validateOrderId, OrderController.initiateReturn);

// Fetch all returned orders
router.get('/orders/returns', authenticateUser, OrderController.getAllReturns);

export default router;
