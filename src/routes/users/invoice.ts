import { Router } from 'express';
import { isAuthenticated } from '@/middleware/auth';
import InvoiceController from '@/controller/InvoiceController';
import Order from '@/models/Order';
import { AuthenticatedRequest } from '@/types';

const router = Router();

router.get('/orders/:orderId/invoice', isAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = (req as AuthenticatedRequest).userId;
    const order = await Order.findById(orderId).select('user');
    if (!order || order.user.toString() !== userId) {
      return res.status(404).json({ message: 'Order not found' });
    }
    return InvoiceController.generateForOrder(req, res);
  } catch (error) {
    console.error('Error serving user invoice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
