import { Request, Response } from 'express';
import GIGService from '@/services/GIGService';
import Order from '@/models/Order';
import Shipment from '@/models/Shipment';

/**
 * GET /admin/gig/config
 * Get the current GIG configuration
 */
const getConfig = async (_req: Request, res: Response) => {
  try {
    const result = await GIGService.getConfig();
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error fetching GIG config:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * PUT /admin/gig/config
 * Upsert GIG configuration
 */
const updateConfig = async (req: Request, res: Response) => {
  try {
    const result = await GIGService.upsertConfig(req.body);
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error updating GIG config:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * GET /admin/gig/stations
 * Proxy to GIG stations API
 */
const getStations = async (_req: Request, res: Response) => {
  try {
    const result = await GIGService.getStations();
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error fetching GIG stations:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * GET /admin/gig/track/:waybill
 * Track a GIG shipment by waybill
 */
const trackShipment = async (req: Request, res: Response) => {
  try {
    const { waybill } = req.params;
    if (!waybill) {
      return res.status(400).json({ message: 'Waybill number is required', data: null, code: 400 });
    }
    const result = await GIGService.trackShipment(waybill);
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error tracking GIG shipment:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * GET /admin/gig/shipments
 * List all GIG orders with their internal shipment status and waybill
 */
const listGIGShipments = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ deliveryType: 'gig', gigWaybill: { $ne: null, $exists: true } })
        .select('_id shippingAddress gigWaybill shipmentId createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ deliveryType: 'gig', gigWaybill: { $ne: null, $exists: true } }),
    ]);

    const shipmentIds = orders.map((o) => o._id);
    const shipments = await Shipment.find({ orderId: { $in: shipmentIds } })
      .select('orderId status trackingHistory')
      .lean();
    const shipmentByOrder = new Map(shipments.map((s) => [String(s.orderId), s]));

    const data = orders.map((order) => {
      const shipment = shipmentByOrder.get(String(order._id));
      const addr = order.shippingAddress as Record<string, string> | undefined;
      return {
        orderId: order._id,
        gigWaybill: order.gigWaybill,
        receiverName: addr ? `${addr.firstName ?? ''} ${addr.lastName ?? ''}`.trim() : '',
        receiverAddress: addr ? [addr.address1, addr.city, addr.state].filter(Boolean).join(', ') : '',
        internalStatus: shipment?.status ?? null,
        createdAt: order.createdAt,
      };
    });

    return res.status(200).json({
      message: 'GIG shipments retrieved',
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      code: 200,
    });
  } catch (error) {
    console.error('Error listing GIG shipments:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

/**
 * GET /admin/gig/shipments/:waybill
 * Get combined GIG API data + internal shipment record for a waybill
 */
const getGIGShipmentInfo = async (req: Request, res: Response) => {
  try {
    const { waybill } = req.params;
    if (!waybill) {
      return res.status(400).json({ message: 'Waybill is required', data: null, code: 400 });
    }

    const [gigResult, order] = await Promise.all([
      GIGService.trackShipment(waybill),
      Order.findOne({ gigWaybill: waybill }).select('_id shippingAddress gigWaybill shipmentId createdAt').lean(),
    ]);

    const shipment = order ? await Shipment.findOne({ orderId: order._id }).lean() : null;

    return res.status(200).json({
      message: 'GIG shipment info retrieved',
      data: {
        gigTracking: gigResult.data,
        order: order ?? null,
        shipment: shipment ?? null,
      },
      code: 200,
    });
  } catch (error) {
    console.error('Error fetching GIG shipment info:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const AdminGIGController = {
  getConfig,
  updateConfig,
  getStations,
  trackShipment,
  listGIGShipments,
  getGIGShipmentInfo,
};

export default AdminGIGController;
