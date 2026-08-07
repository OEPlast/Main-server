import mongoose from 'mongoose';
import Shipment, { IShipment } from '../../models/Shipment';
import { CustomResponseType } from '@/types';
import Order from '@/models/Order';
import { eventPublisher } from '@/events';
import { orderStatusUpdate } from '@/utils/orderStatusTimestamps';
import { loadOrderEmailContext, RETURN_WINDOW_DAYS } from '@/services/email/orderEmailPayload';
import EmailProcessor from '@/services/processor/EmailProcessor';

// Define shipment status union based on updated model enum
type ShipmentStatus = 'In-Warehouse' | 'Shipped' | 'Dispatched' | 'In-Transit' | 'Delivered' | 'Returned' | 'Failed';

type TrackingHistoryEntry = IShipment['trackingHistory'][number];

type ShipmentTrackingDTO = {
  trackingNumber: IShipment['trackingNumber'];
  status: ShipmentStatus;
  estimatedDelivery: IShipment['estimatedDelivery'];
  trackingHistory: TrackingHistoryEntry[];
};

// Helper function to get user-friendly status description
const getStatusDescription = (status: string): string => {
  const statusDescriptions: Record<string, string> = {
    Shipped: 'Product left warehouse',
    Dispatched: 'Product is on its way',
    Delivered: 'Product delivered',
    Returned: 'Product has been returned',
    Failed: 'Something went wrong - shipment is canceled',
  };

  return statusDescriptions[status] || `Status updated to ${status}`;
};

const createShipment = async (shipmentData: Partial<IShipment>): Promise<CustomResponseType<IShipment>> => {
  try {
    // Generate tracking number
    const trackingNumber = 'TRK' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

    const initHistory = [
      {
        location: 'Warehouse',
        description: 'Shipment created',
        timestamp: new Date(),
      },
    ];

    const doc = new Shipment({
      ...shipmentData,
      trackingNumber,
      trackingHistory: initHistory,
    } as IShipment);

    await doc.save();
    await doc.populate('orderId');

    return {
      message: 'Shipment created successfully',
      data: doc as unknown as IShipment,
      code: 201,
    };
  } catch (error) {
    console.error('Error creating shipment:', error);
    return {
      message: 'Failed to create shipment',
      data: null,
      code: 500,
    };
  }
};

const getAllShipments = async (
  page = 1,
  limit = 20,
  status?: ShipmentStatus
): Promise<CustomResponseType<{ shipments: IShipment[]; total: number; page: number; limit: number }>> => {
  try {
    const filter = status ? { status } : {};

    const [shipments, total] = await Promise.all([
      Shipment.find(filter)
        .populate('orderId', 'orderNumber totalAmount')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Shipment.countDocuments(filter),
    ]);

    return {
      message: 'Shipments retrieved successfully',
      data: { shipments: shipments as unknown as IShipment[], total, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error getting shipments:', error);
    return {
      message: 'Failed to retrieve shipments',
      data: null,
      code: 500,
    };
  }
};

const getShipmentById = async (shipmentId: string): Promise<CustomResponseType<IShipment>> => {
  try {
    const shipment = await Shipment.findById(shipmentId).populate({
      path: 'orderId',
      select: 'orderNumber products',
      populate: {
        path: 'products.product',
        select: 'name slug description_images',
      },
    });

    if (!shipment) {
      return {
        message: 'Shipment not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Shipment retrieved successfully',
      data: shipment as unknown as IShipment,
      code: 200,
    };
  } catch (error) {
    console.error('Error getting shipment:', error);
    return {
      message: 'Failed to retrieve shipment',
      data: null,
      code: 500,
    };
  }
};

const getShipmentByTracking = async (trackingNumber: string): Promise<CustomResponseType<IShipment>> => {
  try {
    const shipment = await Shipment.findOne({ trackingNumber }).populate(
      'orderId',
      'orderNumber totalAmount customerInfo'
    );

    if (!shipment) {
      return {
        message: 'Shipment not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Shipment retrieved successfully',
      data: shipment as unknown as IShipment,
      code: 200,
    };
  } catch (error) {
    console.error('Error getting shipment:', error);
    return {
      message: 'Failed to retrieve shipment',
      data: null,
      code: 500,
    };
  }
};

const updateShipment = async (
  shipmentId: string,
  updates: Partial<IShipment>
): Promise<CustomResponseType<IShipment>> => {
  try {
    const shipment = await Shipment.findById(shipmentId);

    if (!shipment) {
      return {
        message: 'Shipment not found',
        data: null,
        code: 404,
      };
    }

    // Delivered lock: prevent updates to status/notes/tracking-related fields when already Delivered
    if (shipment.status === 'Delivered') {
      if (
        typeof updates.status !== 'undefined' ||
        typeof updates.notes !== 'undefined' ||
        typeof (updates as Partial<IShipment> & { trackingHistory?: unknown }).trackingHistory !== 'undefined'
      ) {
        return { message: 'Delivered shipments cannot be modified', data: null, code: 409 };
      }
    }

    // If status is being updated, add to tracking history
    if (updates.status && updates.status !== shipment.status) {
      shipment.trackingHistory.push({
        location: 'Updated',
        description: getStatusDescription(updates.status),
        timestamp: new Date(),
      });
    }
    Object.assign(shipment, updates);
    await shipment.save();
    await shipment.populate('orderId');

    return {
      message: 'Shipment updated successfully',
      data: shipment as unknown as IShipment,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating shipment:', error);
    return {
      message: 'Failed to update shipment',
      data: null,
      code: 500,
    };
  }
};

const trackShipment = async (trackingNumber: string): Promise<CustomResponseType<IShipment>> => {
  try {
    const shipment = await Shipment.findOne({ trackingNumber }).populate('orderId', 'orderNumber customerInfo');

    if (!shipment) {
      return {
        message: 'Shipment not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Shipment tracking information retrieved successfully',
      data: shipment as unknown as IShipment,
      code: 200,
    };
  } catch (error) {
    console.error('Error tracking shipment:', error);
    return {
      message: 'Failed to track shipment',
      data: null,
      code: 500,
    };
  }
};

const addTrackingUpdate = async (
  shipmentId: string,
  trackingUpdate: {
    status: ShipmentStatus;
    location?: string;
    description: string;
  }
): Promise<CustomResponseType<IShipment>> => {
  try {
    const shipment = await Shipment.findById(shipmentId);

    if (!shipment) {
      return {
        message: 'Shipment not found',
        data: null,
        code: 404,
      };
    }

    // Delivered lock
    if (shipment.status === 'Delivered') {
      return { message: 'Delivered shipments cannot be modified', data: null, code: 409 };
    }

    shipment.trackingHistory.push({
      location: trackingUpdate.location || 'Unknown',
      timestamp: new Date(),
      description: trackingUpdate.description,
    });

    // Update current status
    shipment.status = trackingUpdate.status as IShipment['status'];

    // Auto-set deliveredOn when transitioning to Delivered
    if (shipment.status === 'Delivered' && !shipment.deliveredOn) {
      shipment.deliveredOn = new Date();
    }

    await shipment.save();
    await shipment.populate('orderId');

    return {
      message: 'Tracking update added successfully',
      data: shipment as unknown as IShipment,
      code: 200,
    };
  } catch (error) {
    console.error('Error adding tracking update:', error);
    return {
      message: 'Failed to add tracking update',
      data: null,
      code: 500,
    };
  }
};

const deleteShipment = async (shipmentId: string): Promise<CustomResponseType<null>> => {
  try {
    const shipment = await Shipment.findById(shipmentId);

    if (!shipment) {
      return {
        message: 'Shipment not found',
        data: null,
        code: 404,
      };
    }

    await Shipment.findByIdAndDelete(shipmentId);

    return {
      message: 'Shipment deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting shipment:', error);
    return {
      message: 'Failed to delete shipment',
      data: null,
      code: 500,
    };
  }
};

const updateShipmentStatus = async (
  shipmentId: string,
  status: ShipmentStatus,
  note?: string
): Promise<CustomResponseType<IShipment>> => {
  try {
    const shipment = await Shipment.findById(shipmentId).populate({
      path: 'orderId',
      populate: [
        {
          path: 'user',
          select: 'firstName lastName email',
        },
        {
          path: 'products.product',
          select: 'name description_images category',
        },
      ],
    });

    if (!shipment) {
      return {
        message: 'Shipment not found',
        data: null,
        code: 404,
      };
    }

    // Type-safe check for populated order with user and products
    const populatedOrder = shipment.orderId as unknown as {
      _id: mongoose.Types.ObjectId;
      orderNumber: string;
      createdAt: Date;
      gigWaybill?: string;
      user?: {
        email: string;
        firstName: string;
        lastName: string;
      };
      products?: Array<{
        product: {
          name: string;
          description_images?: string[];
          category?: string;
        };
        quantity?: number;
      }>;
    };
    // Delivered lock
    if (shipment.status === 'Delivered') {
      return { message: 'Delivered shipments cannot be modified', data: null, code: 409 };
    }

    // Validate transition (state machine)
    const allowedTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
      'In-Warehouse': ['Shipped', 'Dispatched', 'Delivered', 'Returned', 'Failed'],
      Shipped: ['Dispatched', 'Delivered', 'Returned', 'Failed', 'In-Transit'],
      Dispatched: ['Delivered', 'Returned', 'Failed', 'In-Transit'],
      'In-Transit': ['Delivered', 'Returned', 'Failed'],
      Delivered: [],
      Returned: [],
      Failed: [],
    };
    if (!allowedTransitions[shipment.status as ShipmentStatus].includes(status)) {
      return { message: `Invalid status transition from ${shipment.status} to ${status}`, data: null, code: 409 };
    }

    if (status === 'In-Transit') {
      shipment.trackingHistory.push({
        location: 'On the way',
        description: `Your order is on it's way`,
        timestamp: new Date(),
      });
    }
    if (status === 'Delivered') {
      shipment.trackingHistory.push({
        location: 'Destination',
        description: 'Your order has been Delivered',
        timestamp: new Date(),
      });
    }
    if (status === 'Failed') {
      shipment.trackingHistory.push({
        location: 'Updates',
        description: 'Delivery attempt failed. Please contact support.',
        timestamp: new Date(),
      });

      // A failed delivery told the customer nothing — the tracking-history entry was written
      // and that was the end of it, so an order simply stopped moving with no explanation.
      const failedContext = await loadOrderEmailContext(populatedOrder._id.toString());
      if (failedContext) {
        await EmailProcessor.send('delivery-failed', {
          email: failedContext.email,
          firstName: failedContext.firstName,
          lastName: failedContext.lastName,
          orderId: failedContext.orderId,
          orderNumber: failedContext.orderNumber,
          purchaseDate: failedContext.purchaseDate,
          trackingNumber: shipment.trackingNumber || undefined,
          courierName: shipment.courier || undefined,
          deliveryAddress: shipment.shippingAddress?.address1 || failedContext.shipping.address,
          reason: note || undefined,
          manageOrderLink: failedContext.links.order,
          supportLink: failedContext.links.support,
        });
      }
    }
    if (status === 'Shipped') {
      shipment.trackingHistory.push({
        location: 'Warehouse',
        description: 'Shipment has left the warehouse',
        timestamp: new Date(),
      });

      // Built from the shared order-email context rather than hand-assembled here, so the
      // shipped email quotes the same order number, the same product images and the same
      // storefront links as every other email about this order. The version this replaces
      // sent the Mongo _id as the "order number", omitted the item list entirely, and linked
      // to plasticsnmore.com — a different company's domain.
      const emailContext = await loadOrderEmailContext(populatedOrder._id.toString());
      if (emailContext) {
        await eventPublisher.publishShipmentStatusUpdated({
          email: emailContext.email,
          firstName: emailContext.firstName,
          lastName: emailContext.lastName,
          orderId: emailContext.orderId,
          orderNumber: emailContext.orderNumber,
          purchaseDate: emailContext.purchaseDate,
          trackingNumber: shipment.trackingNumber || '',
          orderStatus: 'Shipped',
          deliveryType: emailContext.deliveryType,
          gigWaybill: emailContext.gigWaybill,
          products: emailContext.products,
          shipping: {
            ...emailContext.shipping,
            courier: shipment.courier || emailContext.shipping.courier,
            address: shipment.shippingAddress?.address1 || emailContext.shipping.address,
          },
          manageOrderLink: emailContext.links.order,
          trackingLink: emailContext.links.tracking,
        });
      }
    }
    /*
    // Add to tracking history
    shipment.trackingHistory.push({
      location: 'Updates',
      description: note || getStatusDescription(status),
      timestamp: new Date(),
    });
*/
    shipment.status = status as IShipment['status'];
    if (shipment.status === 'Delivered' && !shipment.deliveredOn) {
      shipment.deliveredOn = new Date();
      await Order.findByIdAndUpdate(shipment.orderId._id, orderStatusUpdate('Completed'));

      // `populatedOrder.orderNumber` used to be read here against a schema that had no such
      // field, so every delivery email was subject-lined "…has been delivered - undefined";
      // and `description_images?.[0]` was indexed as a string against an array of objects,
      // so none of the product images resolved either.
      const deliveredContext = await loadOrderEmailContext(populatedOrder._id.toString());
      if (deliveredContext) {
        await eventPublisher.publishOrderDelivered({
          email: deliveredContext.email,
          firstName: deliveredContext.firstName,
          lastName: deliveredContext.lastName,
          orderId: deliveredContext.orderId,
          orderNumber: deliveredContext.orderNumber,
          purchaseDate: deliveredContext.purchaseDate,
          products: deliveredContext.products,
          deliveredAt: shipment.deliveredOn.toISOString(),
          courierName: shipment.courier || undefined,
          deliveryAddress: shipment.shippingAddress?.address1 || deliveredContext.shipping.address,
          trackingNumber: shipment.trackingNumber || undefined,
          viewOrderLink: deliveredContext.links.order,
          returnWindowDays: RETURN_WINDOW_DAYS,
          startReturnLink: deliveredContext.links.returns,
          shipmentId: shipment._id.toString(),
        });
      }
    }
    await shipment.save();
    await shipment.populate('orderId');

    return {
      message: 'Shipment status updated successfully',
      data: shipment as unknown as IShipment,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating shipment status:', error);
    return {
      message: 'Failed to update shipment status',
      data: null,
      code: 500,
    };
  }
};

const getShipmentTracking = async (shipmentId: string): Promise<CustomResponseType<ShipmentTrackingDTO>> => {
  try {
    const shipment = await Shipment.findById(shipmentId)
      .select('trackingNumber trackingHistory status estimatedDelivery')
      .populate('orderId', 'orderNumber');

    if (!shipment) {
      return {
        message: 'Shipment not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Shipment tracking retrieved successfully',
      data: {
        trackingNumber: shipment.trackingNumber,
        status: shipment.status as ShipmentStatus,
        estimatedDelivery: shipment.estimatedDelivery,
        trackingHistory: shipment.trackingHistory as TrackingHistoryEntry[],
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error getting shipment tracking:', error);
    return {
      message: 'Failed to retrieve shipment tracking',
      data: null,
      code: 500,
    };
  }
};

const bulkUpdateStatus = async (
  shipmentIds: string[],
  status: ShipmentStatus,
  note?: string
): Promise<CustomResponseType<{ updated: number }>> => {
  try {
    const updatePromises = shipmentIds.map(async (shipmentId) => {
      const shipment = await Shipment.findById(shipmentId);
      if (shipment) {
        shipment.trackingHistory.push({
          location: 'Updated',
          description: note || getStatusDescription(status),
          timestamp: new Date(),
        });
        shipment.status = status as IShipment['status'];
        await shipment.save();
        return true;
      }
      return false;
    });

    const results = await Promise.all(updatePromises);
    const updatedCount = results.filter(Boolean).length;

    return {
      message: `${updatedCount} shipments updated successfully`,
      data: { updated: updatedCount },
      code: 200,
    };
  } catch (error) {
    console.error('Error bulk updating shipment status:', error);
    return {
      message: 'Failed to bulk update shipment status',
      data: null,
      code: 500,
    };
  }
};

const getShipmentsByStatus = async (
  status: ShipmentStatus,
  page = 1,
  limit = 20
): Promise<CustomResponseType<{ shipments: IShipment[]; total: number; page: number; limit: number }>> => {
  try {
    const [shipments, total] = await Promise.all([
      Shipment.find({ status })
        .populate('orderId', 'orderNumber totalAmount')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Shipment.countDocuments({ status }),
    ]);

    return {
      message: 'Shipments retrieved successfully',
      data: { shipments: shipments as unknown as IShipment[], total, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error getting shipments by status:', error);
    return {
      message: 'Failed to retrieve shipments',
      data: null,
      code: 500,
    };
  }
};

// List shipments assigned to a specific courier user
const listByCourierUser = async (
  userId: string,
  page = 1,
  limit = 20,
  status?: ShipmentStatus
): Promise<CustomResponseType<{ shipments: IShipment[]; total: number; page: number; limit: number }>> => {
  try {
    const filter: Record<string, unknown> = { courierUser: new mongoose.Types.ObjectId(userId) };

    if (status) filter.status = status;

    const [shipments, total] = await Promise.all([
      Shipment.find(filter)
        .populate('orderId', 'orderNumber totalAmount')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Shipment.countDocuments(filter),
    ]);

    return {
      message: 'Deliveries retrieved successfully',
      data: { shipments: shipments as unknown as IShipment[], total, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error listing deliveries by courier user:', error);
    return { message: 'Failed to retrieve deliveries', data: null, code: 500 };
  }
};

// Stats for shipments assigned to a courier
const statsByCourierUser = async (
  userId: string
): Promise<CustomResponseType<Record<ShipmentStatus | 'total', number>>> => {
  try {
    const pipeline = [
      { $match: { courierUser: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ];
    const results = await Shipment.aggregate(pipeline);

    const statMap: Record<ShipmentStatus | 'total', number> = {
      'In-Warehouse': 0,
      'In-Transit': 0,
      Shipped: 0,
      Dispatched: 0,
      Delivered: 0,
      Returned: 0,
      Failed: 0,
      total: 0,
    };
    for (const r of results) {
      statMap[r._id as ShipmentStatus] = r.count || 0;
      statMap.total += r.count || 0;
    }
    console.log(statMap);
    return { message: 'Delivery stats retrieved successfully', data: statMap, code: 200 };
  } catch (error) {
    console.error('Error getting delivery stats:', error);
    return { message: 'Failed to retrieve delivery stats', data: null, code: 500 };
  }
};

// Global shipment stats
const statsAll = async (): Promise<CustomResponseType<Record<ShipmentStatus | 'total', number>>> => {
  try {
    const results = await Shipment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const statMap: Record<ShipmentStatus | 'total', number> = {
      'In-Warehouse': 0,
      'In-Transit': 0,
      Shipped: 0,
      Dispatched: 0,
      Delivered: 0,
      Returned: 0,
      Failed: 0,
      total: 0,
    };
    for (const r of results) {
      statMap[r._id as ShipmentStatus] = r.count || 0;
      statMap.total += r.count || 0;
    }
    return { message: 'Shipment stats retrieved successfully', data: statMap, code: 200 };
  } catch (error) {
    console.error('Error getting shipment stats:', error);
    return { message: 'Failed to retrieve shipment stats', data: null, code: 500 };
  }
};

// Update notes separately with delivered lock
const updateNotes = async (shipmentId: string, notes: string): Promise<CustomResponseType<IShipment>> => {
  try {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      return { message: 'Shipment not found', data: null, code: 404 };
    }
    if (shipment.status === 'Delivered') {
      return { message: 'Delivered shipments cannot be modified', data: null, code: 409 };
    }
    shipment.notes = notes;
    await shipment.save();
    await shipment.populate('orderId');
    return { message: 'Shipment notes updated successfully', data: shipment as unknown as IShipment, code: 200 };
  } catch (error) {
    console.error('Error updating shipment notes:', error);
    return { message: 'Failed to update shipment notes', data: null, code: 500 };
  }
};

const ShipmentService = {
  createShipment,
  getAllShipments,
  getShipmentById,
  updateShipment,
  deleteShipment,
  updateShipmentStatus,
  getShipmentTracking,
  bulkUpdateStatus,
  getShipmentsByStatus,
  trackShipment,
  addTrackingUpdate,
  listByCourierUser,
  statsByCourierUser,
  statsAll,
  updateNotes,
  getShipmentByTracking,
};

export default ShipmentService;
