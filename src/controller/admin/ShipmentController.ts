import { Request, Response } from 'express';
import ShipmentService from '../../services/admin/ShipmentService';

const allowedStatuses = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'] as const;
type ShipmentStatus = (typeof allowedStatuses)[number];
const isShipmentStatus = (val: unknown): val is ShipmentStatus =>
  typeof val === 'string' && (allowedStatuses as readonly string[]).includes(val);

const createShipment = async (req: Request, res: Response) => {
  try {
    const shipmentData = req.body;
    const result = await ShipmentService.createShipment(shipmentData);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in createShipment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllShipments = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const statusFilter = isShipmentStatus(status) ? status : undefined;
    const result = await ShipmentService.getAllShipments(Number(page), Number(limit), statusFilter);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getAllShipments:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getShipmentById = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const result = await ShipmentService.getShipmentById(shipmentId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getShipmentById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateShipment = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const updateData = req.body;
    if (updateData && 'status' in updateData && !isShipmentStatus(updateData.status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const result = await ShipmentService.updateShipment(shipmentId, updateData);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in updateShipment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteShipment = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const result = await ShipmentService.deleteShipment(shipmentId);
    return res.status(result.code).json({ message: result.message });
  } catch (error) {
    console.error('Error in deleteShipment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateShipmentStatus = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const { status, note } = req.body as { status?: unknown; note?: string };
    if (!isShipmentStatus(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const result = await ShipmentService.updateShipmentStatus(shipmentId, status, note);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in updateShipmentStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getShipmentTracking = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const result = await ShipmentService.getShipmentTracking(shipmentId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getShipmentTracking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const addTrackingUpdate = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const trackingData = req.body as { status?: unknown; location?: string; description?: string };
    if (!isShipmentStatus(trackingData.status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const result = await ShipmentService.addTrackingUpdate(shipmentId, {
      status: trackingData.status,
      location: trackingData.location,
      description: trackingData.description ?? '',
    });
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in addTrackingUpdate:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const bulkUpdateStatus = async (req: Request, res: Response) => {
  try {
    const { shipmentIds, status, note } = req.body as { shipmentIds: string[]; status?: unknown; note?: string };
    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return res.status(400).json({ error: 'shipmentIds must be a non-empty array' });
    }
    if (!isShipmentStatus(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const result = await ShipmentService.bulkUpdateStatus(shipmentIds, status, note);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in bulkUpdateStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getShipmentsByStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.params as { status: string };
    const { page = 1, limit = 10 } = req.query;
    if (!isShipmentStatus(status)) {
      return res.status(400).json({ error: 'Invalid status parameter' });
    }
    const result = await ShipmentService.getShipmentsByStatus(status, Number(page), Number(limit));
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getShipmentsByStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createShipment,
  getAllShipments,
  getShipmentById,
  updateShipment,
  deleteShipment,
  updateShipmentStatus,
  getShipmentTracking,
  addTrackingUpdate,
  bulkUpdateStatus,
  getShipmentsByStatus,
};
