//user order route
import express from 'express';
import OrderController from '../../controller/orderController';
import OrderValidator from '../../validators/OrderValidator';
import { authenticateUser } from '@/middleware/auth';

const router = express.Router();

// Fetch user orders
router.get('/orders', authenticateUser, OrderValidator.validateOrderQueryParams, OrderController.getOrders);

// Fetch all returned orders (placed before :id route to avoid shadowing)
router.get('/orders/returns', authenticateUser, OrderController.getAllReturns);

// Get order by ID
router.get('/orders/:id', authenticateUser, OrderValidator.validateOrderId, OrderController.getOrderById);

// Update an order
// router.put('/orders/:id', authenticateUser, OrderValidator.validateOrderId, OrderController.updateOrder);

// Cancel an order (users can cancel but cannot delete)
router.post('/orders/:id/cancel', authenticateUser, OrderValidator.validateOrderId, OrderController.cancelOrder);

// Initiate a return for an order
router.post('/orders/:id/return', authenticateUser, OrderValidator.validateOrderId, OrderController.initiateReturn);

export default router;
