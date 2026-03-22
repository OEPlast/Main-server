import mongoose from 'mongoose';
import Shipment, { IShipment } from '@/models/Shipment';
import Order from '@/models/Order';
import { CustomResponseType } from '@/types';
import eventPublisher from '@/events/eventPublisher';

/**
 * Auto-generates a shipment for an order with shipping delivery type
 */
const createShipmentForOrder = async (
  orderId: string | mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<{ shipment: IShipment; trackingNumber: string } | null> => {
  try {
    const order = await Order.findById(orderId).session(session || null);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.deliveryType !== 'shipping' && order.deliveryType !== 'gig') {
      return null; // No shipment needed for pickup orders
    }

    if (!order.shippingAddress) {
      throw new Error('Shipping address is required for shipping orders');
    }
    // Create shipment with order data
    const shipmentData = {
      orderId: order._id,
      courier: order.deliveryType === 'gig' ? 'GIG Logistics' : 'Default Courier',
      status: 'In-Warehouse' as IShipment['status'],
      shippingAddress: {
        firstName: order.shippingAddress.firstName || '',
        lastName: order.shippingAddress.lastName || '',
        phoneNumber: order.shippingAddress.phoneNumber || '',
        address1: order.shippingAddress.address1 || '',
        address2: order.shippingAddress.address2 || '',
        city: order.shippingAddress.city || '',
        state: order.shippingAddress.state || '',
        lga: order.shippingAddress.lga || '',
        zipCode: order.shippingAddress.zipCode || '',
        country: order.shippingAddress.country || 'Nigeria',
      },
      cost: order.shippingPrice || 0,
      trackingHistory: [
        {
          location: 'Warehouse',
          timestamp: new Date(),
          description: 'Shipment created and ready for processing',
        },
      ],
    };

    const shipment = new Shipment(shipmentData);
    await shipment.save({ session: session || undefined });

    await Order.updateOne({ _id: orderId }, { $set: { shipmentId: shipment._id } }, { session: session || undefined });

    // Publish shipment created event
    try {
      await eventPublisher.publishShipmentCreated({
        shipmentId: shipment._id.toString(),
        orderId: order._id.toString(),
        trackingNumber: shipment.trackingNumber!,
        status: shipment.status,
      });
    } catch (eventError) {
      console.error('Failed to publish shipment created event:', eventError);
      // Don't fail shipment creation if event publishing fails
    }

    return { shipment, trackingNumber: shipment.trackingNumber! };
  } catch (error) {
    console.error('Error creating shipment for order:', error);
    throw error;
  }
};

/**
 * Gets shipment for a specific order
 */
const getShipmentForOrder = async (orderId: string, userId?: string): Promise<CustomResponseType<IShipment>> => {
  try {
    // First verify order exists and belongs to user if userId provided
    const orderQuery: Record<string, unknown> = { _id: orderId };
    if (userId) {
      orderQuery.user = userId;
    }

    const order = await Order.findOne(orderQuery).select('shipmentId deliveryType');

    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }

    if (order.deliveryType !== 'shipping') {
      return {
        message: 'This order does not have shipping - pickup orders do not have shipments',
        data: null,
        code: 400,
      };
    }

    if (!order.shipmentId) {
      return {
        message: 'No shipment found for this order',
        data: null,
        code: 404,
      };
    }

    const shipment = await Shipment.findById(order.shipmentId).populate('orderId', 'total status');

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
    console.error('Error getting shipment for order:', error);
    return {
      message: 'Failed to retrieve shipment',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets all shipments for a user's orders
 */
const getUserShipments = async (
  userId: string,
  page = 1,
  limit = 10
): Promise<CustomResponseType<{ shipments: IShipment[]; total: number; page: number; limit: number }>> => {
  try {
    // Find all orders for this user that have shipping
    const userOrders = await Order.find({
      user: userId,
      deliveryType: 'shipping',
      shipmentId: { $exists: true, $ne: null },
    }).select('shipmentId');

    const shipmentIds = userOrders.map((order) => order.shipmentId).filter(Boolean);

    if (shipmentIds.length === 0) {
      return {
        message: 'No shipments found',
        data: { shipments: [], total: 0, page, limit },
        code: 200,
      };
    }

    const [shipments, total] = await Promise.all([
      Shipment.find({ _id: { $in: shipmentIds } })
        .populate('orderId', 'total status createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Shipment.countDocuments({ _id: { $in: shipmentIds } }),
    ]);

    return {
      message: 'Shipments retrieved successfully',
      data: { shipments: shipments as unknown as IShipment[], total, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error getting user shipments:', error);
    return {
      message: 'Failed to retrieve shipments',
      data: null,
      code: 500,
    };
  }
};

/**
 * Tracks shipment by tracking number (public endpoint)
 */
const trackShipmentByTrackingNumber = async (trackingNumber: string): Promise<CustomResponseType<IShipment>> => {
  try {
    const shipment = await Shipment.findOne({ trackingNumber }).populate('orderId', 'total status');

    if (!shipment) {
      return {
        message: 'Shipment not found with this tracking number',
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

/**
 * Gets delivery status for an order (used for populating orders with delivery status from shipment)
 */
const getDeliveryStatus = async (orderId: string): Promise<string> => {
  try {
    const order = await Order.findById(orderId).select('deliveryType shipmentId');

    if (!order) {
      return 'Unknown';
    }

    if (order.deliveryType !== 'shipping') {
      return 'Pickup'; // For pickup orders, return 'Pickup' as status
    }

    if (!order.shipmentId) {
      return 'Processing'; // Order created but shipment not yet created
    }

    const shipment = await Shipment.findById(order.shipmentId).select('status');

    return shipment?.status || 'Unknown';
  } catch (error) {
    console.error('Error getting delivery status:', error);
    return 'Unknown';
  }
};

const ShipmentService = {
  createShipmentForOrder,
  getShipmentForOrder,
  getUserShipments,
  trackShipmentByTrackingNumber,
  getDeliveryStatus,
};

export default ShipmentService;
