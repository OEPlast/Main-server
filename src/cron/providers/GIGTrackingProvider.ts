import GIGService from '@/services/GIGService';
import type { TrackingProvider, OrderDoc, ShipmentDoc } from './TrackingProvider';

const GIG_STATUS_MAP: Record<string, string> = {
  // Delivered
  MAHD: 'Delivered', SHD: 'Delivered', OKC: 'Delivered',
  // In transit
  MSHC: 'In-Transit', WC: 'In-Transit', OFDU: 'In-Transit',
  MSVC: 'In-Transit', MDSE: 'In-Transit', ARP: 'In-Transit',
  APT: 'In-Transit', DST: 'In-Transit', AST: 'In-Transit',
  DTR: 'In-Transit', DPC: 'In-Transit',
  // Shipped / picked up
  MPIK: 'Shipped', PICKED: 'Shipped',
  // Dispatched
  MAPT: 'Dispatched', MENP: 'Dispatched',
  // Returned / cancelled
  MSCC: 'Returned', MSCP: 'Returned', SSC: 'Returned', MRTE: 'Returned',
  // Failed
  FID: 'Failed', DFA: 'Failed', ATD: 'Failed',
};

export const GIGTrackingProvider: TrackingProvider = {
  deliveryType: 'gig',

  getTrackingRef(order: OrderDoc): string | null {
    return order.gigWaybill ?? null;
  },

  async syncShipment(order: OrderDoc, shipment: ShipmentDoc): Promise<void> {
    const waybill = order.gigWaybill as string;
    const result = await GIGService.trackShipment(waybill);
    if (!result.data || result.data.length === 0) return;

    const gigStatus = result.data[0].shipmentstatus?.toUpperCase();
    const mappedStatus = gigStatus ? GIG_STATUS_MAP[gigStatus] : undefined;
    if (!mappedStatus || mappedStatus === shipment.status) return;

    shipment.status = mappedStatus as typeof shipment.status;
    shipment.trackingHistory.push({
      location: '',
      timestamp: new Date(),
      description: `GIG status: ${result.data[0].shipmentstatus}`,
    });
    if (mappedStatus === 'Delivered') {
      shipment.deliveredOn = new Date();
    }
    await shipment.save();
  },
};
