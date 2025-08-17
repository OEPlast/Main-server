import { Router } from 'express';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';
import InvoiceController from '@/controller/InvoiceController';
import Order from '@/models/Order';

const router = Router();

router.use(authenticateUser, isAdmin);

router.post('/:orderId/generate', requirePermission('invoices', 'create'), InvoiceController.generateInvoiceForOrder);

router.get('/', requirePermission('invoices', 'read'), async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const orders = await Order.find({ isPaid: true })
      .select('_id total user createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await Order.countDocuments({ isPaid: true });
    return res.status(200).json({ message: 'Invoices (orders) retrieved', data: { orders, total, page, limit } });
  } catch (error) {
    console.error('Error listing invoices:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:orderId', requirePermission('invoices', 'read'), InvoiceController.generateInvoiceForOrder);

export default router;
