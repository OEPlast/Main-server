import cron from 'node-cron';
import Order from '@/models/Order';
import Shipment from '@/models/Shipment';
import { trackingRegistry } from './providers';

const TERMINAL_STATUSES = new Set(['Delivered', 'Returned', 'Failed']);
const BATCH_SIZE = 50;

async function syncTrackingForProvider(deliveryType: string): Promise<void> {
  const provider = trackingRegistry.getProvider(deliveryType);
  if (!provider) return;

  let skip = 0;

  while (true) {
    const orders = await Order.find({ deliveryType })
      .select('_id deliveryType gigWaybill')
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (orders.length === 0) break;

    for (const order of orders) {
      try {
        const trackingRef = provider.getTrackingRef(order as never);
        if (!trackingRef) continue;

        const shipment = await Shipment.findOne({ orderId: order._id });
        if (!shipment || TERMINAL_STATUSES.has(shipment.status)) continue;

        await provider.syncShipment(order as never, shipment as never);
      } catch (err) {
        console.error(`[tracking-sync] ${deliveryType} error for order ${order._id}:`, err);
      }
    }

    if (orders.length < BATCH_SIZE) break;
    skip += orders.length;
  }
}

async function runTrackingSync(): Promise<void> {
  const types = trackingRegistry.registeredTypes;
  await Promise.allSettled(types.map(syncTrackingForProvider));
}

export function startGIGTrackingSync(): void {
  cron.schedule('*/4 * * * *', () => {
    runTrackingSync().catch((err) =>
      console.error('[tracking-sync] Unhandled batch error:', err)
    );
  });
  console.log(`[tracking-sync] Started for providers: ${trackingRegistry.registeredTypes.join(', ')}`);
}
