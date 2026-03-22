import { Request, Response } from 'express';
import GIGService from '@/services/GIGService';

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

const AdminGIGController = {
  getConfig,
  updateConfig,
  getStations,
  trackShipment,
};

export default AdminGIGController;
