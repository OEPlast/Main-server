import type { IShipment } from '@/models/Shipment';

type ShipmentLike = IShipment & {
  _id?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  toObject?: () => IShipment & { _id?: unknown; createdAt?: Date; updatedAt?: Date };
};

/**
 * The view of a shipment that anyone holding its tracking number may see.
 *
 * Tracking numbers get shared in screenshots, chats and courier SMS. The public endpoints used to
 * return the whole document: the recipient's phone number, street address and postcode, plus
 * (on /logistics/track) the order's customer contact details. This keeps what a tracking page
 * needs (status, dates, courier, history, a delivery area) and drops everything that identifies
 * or locates the customer.
 */
export function toPublicShipment(shipment: ShipmentLike): IShipment {
  const doc = typeof shipment.toObject === 'function' ? shipment.toObject() : shipment;
  const address = doc.shippingAddress;
  const order = doc.orderId as unknown as { _id?: unknown; orderNumber?: string; status?: string } | null;

  return {
    _id: doc._id,
    trackingNumber: doc.trackingNumber,
    courier: doc.courier,
    status: doc.status,
    estimatedDelivery: doc.estimatedDelivery,
    deliveredOn: doc.deliveredOn,
    trackingHistory: doc.trackingHistory,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    orderId:
      order && typeof order === 'object' && '_id' in order
        ? { _id: order._id, orderNumber: order.orderNumber, status: order.status }
        : doc.orderId,
    shippingAddress: address
      ? {
          firstName: address.firstName,
          lastName: address.lastName ? `${address.lastName.charAt(0)}.` : '',
          city: address.city,
          state: address.state,
          country: address.country,
        }
      : undefined,
  } as unknown as IShipment;
}
