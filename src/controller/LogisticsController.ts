import ShipmentService from '@/services/admin/ShipmentService';
import { Request, Response } from 'express';
const trackOrder = async (req: Request, res: Response) => {
  try {
    const { trackingNumber } = req.params;
    const result = await ShipmentService.trackShipment(trackingNumber);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error tracking shipment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const LogisticsController = { trackOrder };
export default LogisticsController;
