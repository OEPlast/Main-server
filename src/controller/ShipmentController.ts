import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import ShipmentService from '@/services/ShipmentService';

/**
 * Get shipment for a specific order (user must own the order)
 */
export const getOrderShipment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;

    const { data, message, code } = await ShipmentService.getShipmentForOrder(orderId, userId);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderShipment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all shipments for the authenticated user
 */
export const getUserShipments = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const { page = 1, limit = 10 } = req.query;

    const { data, message, code } = await ShipmentService.getUserShipments(
      userId, 
      Number(page), 
      Number(limit)
    );
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getUserShipments:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Track shipment by tracking number (public endpoint - no authentication required)
 */
export const trackShipment = async (req: Request, res: Response) => {
  try {
    const { trackingNumber } = req.params;

    if (!trackingNumber) {
      return res.status(400).json({ 
        message: 'Tracking number is required',
        data: null 
      });
    }

    const { data, message, code } = await ShipmentService.trackShipmentByTrackingNumber(trackingNumber);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in trackShipment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get delivery status for an order
 */
export const getOrderDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;

    // First verify the user owns this order
    const shipmentResult = await ShipmentService.getShipmentForOrder(orderId, userId);
    if (shipmentResult.code === 404) {
      return res.status(404).json({ 
        message: 'Order not found or access denied',
        data: null 
      });
    }

    const deliveryStatus = await ShipmentService.getDeliveryStatus(orderId);
    
    return res.status(200).json({
      message: 'Delivery status retrieved successfully',
      data: { 
        orderId,
        deliveryStatus,
        hasShipment: shipmentResult.data !== null
      }
    });
  } catch (error) {
    console.error('Error in getOrderDeliveryStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const ShipmentController = {
  getOrderShipment,
  getUserShipments,
  trackShipment,
  getOrderDeliveryStatus,
};

export default ShipmentController;
