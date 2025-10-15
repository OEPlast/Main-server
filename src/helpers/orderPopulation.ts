import Order from '@/models/Order';
import ShipmentService from '@/services/ShipmentService';

/**
 * Populates orders with delivery status from their associated shipments
 */
export const populateOrdersWithDeliveryStatus = async (orders: any[]): Promise<any[]> => {
  if (!orders || orders.length === 0) {
    return orders;
  }

  const populatedOrders = await Promise.all(
    orders.map(async (order) => {
      const deliveryStatus = await ShipmentService.getDeliveryStatus(order._id.toString());
      return {
        ...order,
        deliveryStatus, // Add computed delivery status
      };
    })
  );

  return populatedOrders;
};

/**
 * Populates a single order with delivery status from its associated shipment
 */
export const populateOrderWithDeliveryStatus = async (order: any): Promise<any> => {
  if (!order) {
    return order;
  }

  const deliveryStatus = await ShipmentService.getDeliveryStatus(order._id.toString());
  return {
    ...order,
    deliveryStatus, // Add computed delivery status
  };
};
