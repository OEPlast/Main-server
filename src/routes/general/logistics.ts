import { Router } from 'express';
import ShipmentService from '@/services/admin/ShipmentService';

const router = Router();

// Public: Track shipment by tracking number
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const result = await ShipmentService.trackShipment(trackingNumber);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error tracking shipment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
