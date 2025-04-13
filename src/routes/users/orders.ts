//user order route
import express from 'express';
import OrderController from '../../controller/orderController';
import OrderValidator from '../../validators/OrderValidator';
import { isAuthenticated } from '@/middleware/auth';

const router = express.Router();

// Fetch user orders
router.get('/orders', isAuthenticated, OrderController.getOrders);

// Place a new order
router.post('/orders', isAuthenticated, OrderValidator.validateOrderPlacement, OrderController.placeOrder);

// Get order by ID
router.get('/orders/:id', isAuthenticated, OrderValidator.validateOrderId, OrderController.getOrderById);

// Update an order
router.put('/orders/:id', isAuthenticated, OrderValidator.validateOrderId, OrderController.updateOrder);

// Cancel an order
router.delete('/orders/:id', isAuthenticated, OrderValidator.validateOrderId, OrderController.cancelOrder);

// Initiate a return for an order
router.post('/orders/:id/return', isAuthenticated, OrderValidator.validateOrderId, OrderController.initiateReturn);

// Fetch all returned orders
router.get('/orders/returns', isAuthenticated, OrderController.getAllReturns);

export default router;
