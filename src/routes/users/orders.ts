//user order route
import express from 'express';
import OrderController from '../../controller/orderController';
import OrderValidator from '../../validators/OrderValidator';
import { authenticateUser } from '@/middleware/auth';
import InvoiceController from '@/controller/InvoiceController';

const router = express.Router();

// Fetch user orders
router.get('/orders', authenticateUser, OrderController.getOrders);

// Place a new order
router.post('/orders', authenticateUser, OrderValidator.validateOrderPlacement, OrderController.placeOrder);

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

router.get('/orders/:orderId/invoice', authenticateUser, InvoiceController.generateInvoiceForOrder);
export default router;
