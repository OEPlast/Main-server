import { Types } from 'mongoose';

export interface OrderDoc {
  _id: Types.ObjectId;
  deliveryType: string;
  gigWaybill?: string | null;
  [key: string]: unknown;
}

export interface ShipmentDoc {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  status: string;
  trackingHistory: Array<{ location: string; timestamp: Date; description: string }>;
  deliveredOn?: Date;
  save(): Promise<unknown>;
}

export interface TrackingProvider {
  readonly deliveryType: string;
  /** Extract the carrier tracking reference from an order. Return null to skip. */
  getTrackingRef(order: OrderDoc): string | null;
  /** Fetch latest status from the carrier and update the shipment if changed. */
  syncShipment(order: OrderDoc, shipment: ShipmentDoc): Promise<void>;
}
