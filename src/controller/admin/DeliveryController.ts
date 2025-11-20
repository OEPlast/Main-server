import { Request, Response } from 'express';
import ShipmentService from '@/services/admin/ShipmentService';
import { AuthenticatedRequest } from '@/types';

const allowedStatuses = ['In-Warehouse', 'Shipped', 'Dispatched','In-Transit', 'Delivered', 'Returned', 'Failed'] as const;
type ShipmentStatus = (typeof allowedStatuses)[number];
const isShipmentStatus = (val: unknown): val is ShipmentStatus =>
  typeof val === 'string' && (allowedStatuses as readonly string[]).includes(val);

const listMine = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = (req as AuthenticatedRequest).userId!;
    const statusFilter = isShipmentStatus(status) ? status : undefined;
    const result = await ShipmentService.listByCourierUser(userId, Number(page), Number(limit), statusFilter);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in listMine:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const statsMine = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const result = await ShipmentService.statsByCourierUser(userId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in statsMine:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getById = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;
    const result = await ShipmentService.getShipmentById(shipmentId);
    if (result.code !== 200 || !result.data) {
      return res.status(result.code).json({ message: result.message, data: result.data });
    }
    if (String(result.data.courierUser) !== String(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return res.status(200).json({ message: 'Delivery retrieved successfully', data: result.data });
  } catch (error) {
    console.error('Error in getById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getByTracking = async (req: Request, res: Response) => {
  try {
    const { tracking } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;
    const result = await ShipmentService.getShipmentByTracking(tracking);
    if (result.code !== 200 || !result.data) {
      return res.status(result.code).json({ message: result.message, data: result.data });
    }
    if (String(result.data.courierUser) !== String(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return res.status(200).json({ message: 'Delivery retrieved successfully', data: result.data });
  } catch (error) {
    console.error('Error in getById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const updateStatus = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const { status, note } = req.body as { status?: unknown; note?: string };
    if (!isShipmentStatus(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    // Ownership check
    const base = await ShipmentService.getShipmentById(shipmentId);
    const userId = (req as AuthenticatedRequest).userId!;
    if (base.code !== 200 || !base.data) return res.status(base.code).json({ message: base.message });
    if (String(base.data.courierUser) !== String(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const result = await ShipmentService.updateShipmentStatus(shipmentId, status, note);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in updateStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const addTrackingUpdate = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const { status, location, description } = req.body as {
      status?: unknown;
      location?: string;
      description?: string;
    };
    if (!isShipmentStatus(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const base = await ShipmentService.getShipmentById(shipmentId);
    const userId = (req as AuthenticatedRequest).userId!;
    if (base.code !== 200 || !base.data) return res.status(base.code).json({ message: base.message });
    if (String(base.data.courierUser) !== String(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const result = await ShipmentService.addTrackingUpdate(shipmentId, {
      status,
      location,
      description: description ?? '',
    });
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in addTrackingUpdate:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateNotes = async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const { notes } = req.body as { notes?: string };
    const base = await ShipmentService.getShipmentById(shipmentId);
    const userId = (req as AuthenticatedRequest).userId!;
    if (base.code !== 200 || !base.data) return res.status(base.code).json({ message: base.message });
    if (String(base.data.courierUser) !== String(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const result = await ShipmentService.updateNotes(shipmentId, notes || '');
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in updateNotes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default { listMine, statsMine, getById, getByTracking,updateStatus, addTrackingUpdate, updateNotes };
