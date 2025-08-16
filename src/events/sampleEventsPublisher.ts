/*
 * Sample Events Publisher
 * Purpose: Quick manual test tool to emit one instance of most EventType values
 * Run (dev): npx ts-node -r tsconfig-paths/register src/events/sampleEventsPublisher.ts
 * Or after adding npm script: npm run publish:sample-events
 */
import { eventPublisher } from '@/events';
import { EventType } from '@/events/eventTypes';
import { config as envConfig } from 'dotenv';

envConfig();

async function main() {
  await eventPublisher.connect();

  // User events
  await eventPublisher.publishUserSignup({
    userId: 'u1',
    email: 'chocoscoding@gmail.com',
    firstName: 'Alice',
    otp: 123456,
  });

  /*
  await eventPublisher.publish(EventType.USER_LOGIN, { userId: 'u1' });
  await eventPublisher.publish(EventType.USER_PROFILE_UPDATED, { userId: 'u1', changed: ['firstName'] });

  // Product + Inventory
  await eventPublisher.publish(EventType.PRODUCT_CREATED, { productId: 'p1', name: 'Sample Product', price: 1999 });
  await eventPublisher.publish(EventType.PRODUCT_UPDATED, { productId: 'p1', changes: { price: 1499 } });
  await eventPublisher.publish(EventType.PRODUCT_DELETED, { productId: 'p2' });
  await eventPublisher.publishPriceChanged('p1', 1999, 1499, 25);
  await eventPublisher.publishInventoryLow('p1', 3, 5, 'Sample Product');
  await eventPublisher.publish(EventType.INVENTORY_OUT_OF_STOCK, { productId: 'p3', productName: 'Other Product' });
  await eventPublisher.publish(EventType.INVENTORY_RESTOCKED, {
    productId: 'p1',
    productName: 'Sample Product',
    newStock: 50,
    previousStock: 3,
    restockQuantity: 47,
  });

  // Order lifecycle
  await eventPublisher.publishOrderCreated({
    orderId: 'o1',
    userId: 'u1',
    orderNumber: 'ORD-1001',
    totalAmount: 1499,
    items: [{ productId: 'p1', quantity: 1, price: 1499 }],
    customerInfo: { email: 'user1@example.com', name: 'Alice' },
  });
  await eventPublisher.publish(EventType.ORDER_UPDATED, { orderId: 'o1', userId: 'u1', status: 'processing' });
  await eventPublisher.publish(EventType.ORDER_CANCELLED, { orderId: 'o2', userId: 'u1', reason: 'user_request' });
  await eventPublisher.publishOrderPaid({
    orderId: 'o1',
    userId: 'u1',
    totalAmount: 1499,
    items: [{ productId: 'p1', quantity: 1, price: 1499 }],
  });
  await eventPublisher.publishOrderShipped({
    orderId: 'o1',
    userId: 'u1',
    trackingNumber: 'TRK123',
    shippingProvider: 'DHL',
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  });
  await eventPublisher.publish(EventType.ORDER_DELIVERED, {
    orderId: 'o1',
    userId: 'u1',
    deliveredAt: new Date().toISOString(),
  });

  // Payment events
  await eventPublisher.publishPaymentSuccessful({
    orderId: 'o1',
    userId: 'u1',
    paymentId: 'pay_123',
    amount: 1499,
    paymentMethod: 'paystack',
  });
  await eventPublisher.publish(EventType.PAYMENT_FAILED, { orderId: 'o2', userId: 'u1', reference: 'ref_fail_1' });
  await eventPublisher.publish(EventType.PAYMENT_REFUNDED, {
    orderId: 'o1',
    userId: 'u1',
    refundId: 'ref_1',
    amount: 500,
  });

  // Notification / email
  await eventPublisher.publishNotification({
    userId: 'u1',
    email: 'user1@example.com',
    message: 'Your order has shipped',
    subject: 'Order Shipped',
  });
  await eventPublisher.publishEmail({
    userId: 'u1',
    email: 'user1@example.com',
    template: 'order_shipped',
    subject: 'Your Order is on the way',
    templateData: { orderNumber: 'ORD-1001' },
  });

  // Bulk notification
  await eventPublisher.publishBulkNotification({
    userIds: ['u1', 'u2'],
    message: 'Big sale starts now!',
    subject: 'Sale',
  });

  // Admin action sample (coupon redeemed)
  await eventPublisher.publishCouponRedeemed({
    couponId: 'c1',
    userId: 'u1',
    orderId: 'o1',
    amountDiscounted: 500,
    code: 'SAVE25',
  });
  await eventPublisher.publish(EventType.ADMIN_ACTION, { action: 'admin.login', adminId: 'admin1' });

  // File upload events
  await eventPublisher.publish(EventType.FILE_UPLOADED, { fileId: 'f1', path: '/uploads/f1.png', userId: 'u1' });
  await eventPublisher.publish(EventType.FILE_DELETED, { fileId: 'f2', path: '/uploads/f2.png', userId: 'u1' });

  // Shipment events
  await eventPublisher.publish(EventType.SHIPMENT_CREATED, { shipmentId: 's1', orderId: 'o1', provider: 'DHL' });
  await eventPublisher.publish(EventType.SHIPMENT_STATUS_UPDATED, { shipmentId: 's1', status: 'in_transit' });

  // Campaign events
  await eventPublisher.publish(EventType.CAMPAIGN_CREATED, { campaignId: 'camp1', name: 'Spring Sale' });
  await eventPublisher.publish(EventType.CAMPAIGN_STARTED, {
    campaignId: 'camp1',
    startedAt: new Date().toISOString(),
  });
  await eventPublisher.publish(EventType.CAMPAIGN_ENDED, { campaignId: 'camp1', endedAt: new Date().toISOString() });

  // Review events
  await eventPublisher.publish(EventType.REVIEW_CREATED, { reviewId: 'r1', productId: 'p1', userId: 'u1', rating: 5 });
  await eventPublisher.publish(EventType.REVIEW_UPDATED, { reviewId: 'r1', productId: 'p1', rating: 4 });

  // Data sync
  await eventPublisher.publish(EventType.DATA_SYNC, { scope: 'products', startedAt: Date.now() });

  // Websocket test event
  await eventPublisher.publishWebsocketOrderUpdate({
    orderId: 'o1',
    status: 'in_transit',
    message: 'Your package is moving.',
  });
*/
  console.log('Sample events published. Waiting briefly before exit...');
  setTimeout(async () => {
    await eventPublisher.disconnect();
    process.exit(0);
  }, 1000);
}

main().catch(async (err) => {
  console.error('Sample publisher error', err);
  try {
    await eventPublisher.disconnect();
  } catch {}
  process.exit(1);
});
