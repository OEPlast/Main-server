import { Router } from 'express';
import { isAuthenticated } from '@/middleware/auth';
import Shipment from '@/models/Shipment';
import Order from '@/models/Order';
import { AuthenticatedRequest } from '@/types';

const router = Router();

// User: Get shipment for an order
router.get('/orders/:orderId/shipment', isAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = (req as AuthenticatedRequest).userId;
    const order = await Order.findById(orderId).select('user');
    if (!order || order.user.toString() !== userId) {
      return res.status(404).json({ message: 'Shipment not found' });
    }
    const shipment = await Shipment.findOne({ orderId });
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
    return res.status(200).json({ message: 'Shipment retrieved', data: shipment });
  } catch (error) {
    console.error('Error getting shipment for order:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// User: List my shipments
router.get('/shipments', isAuthenticated, async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const userId = (req as AuthenticatedRequest).userId;

    // Find orders for this user and then fetch shipments for those orders
    const orderIds = await Order.find({ user: userId }).select('_id');
    const orderIdList = orderIds.map((o) => o._id);

    const [shipments, total] = await Promise.all([
      Shipment.find({ orderId: { $in: orderIdList } })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Shipment.countDocuments({ orderId: { $in: orderIdList } }),
    ]);

    return res.status(200).json({
      message: 'Shipments retrieved',
      data: { shipments, total, page, limit },
    });
  } catch (error) {
    console.error('Error listing user shipments:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
