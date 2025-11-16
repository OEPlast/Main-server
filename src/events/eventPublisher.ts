import amqplib, { type Channel } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { EventType, type BaseEvent } from './eventTypes';

// Simplified: single topic exchange. Consumers can bind a queue with patterns (e.g. order.*, payment.#, #)
const EXCHANGE_NAME = 'app.events';

// Use minimal structural connection type to avoid tight coupling to amqplib's internal Connection interface
type SimpleConnection = {
  createChannel: () => Promise<Channel>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  close: () => Promise<void> | void;
};

class EventPublisher {
  private connection: SimpleConnection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected) return; // idempotent
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    try {
      const connection = (await amqplib.connect(rabbitmqUrl)) as unknown as SimpleConnection;
      const channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

      this.connection = connection;
      this.channel = channel;
      this.isConnected = true;
      console.log('[events] connected');

      connection.on('close', () => {
        this.isConnected = false;
        console.warn('[events] connection closed');
      });
      connection.on('error', (err) => {
        console.error('[events] connection error', err);
      });
    } catch (err) {
      console.error('[events] failed to connect', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
      if (this.connection) {
        try {
          await this.connection.close();
        } catch {
          /* swallow */
        }
      }
    } catch (err) {
      console.error('[events] disconnect error', err);
    } finally {
      this.isConnected = false;
    }
  }

  async publish(
    eventType: EventType,
    data: Record<string, unknown> = {},
    opts?: { userId?: string; source?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    if (!this.channel || !this.isConnected) {
      console.warn('[events] publish attempted while disconnected; retrying connect…');
      await this.connect();
      if (!this.channel) {
        console.error('[events] still not connected, dropping event', eventType);
        return;
      }
    }
    const event: BaseEvent = {
      id: uuidv4(),
      type: eventType,
      timestamp: new Date(),
      source: opts?.source || 'main-server',
      userId: opts?.userId,
      metadata: opts?.metadata,
      data,
    };
    try {
      const payload = Buffer.from(JSON.stringify(event));
      this.channel.publish(EXCHANGE_NAME, eventType, payload, {
        contentType: 'application/json',
        persistent: true,
        messageId: event.id,
        timestamp: event.timestamp.getTime(),
        type: eventType,
        headers: { source: event.source },
      });
      // Lightweight debug log; can swap with central logger later
      console.log(`[events] published ${eventType} id=${event.id}`);
    } catch (err) {
      console.error(`[events] failed to publish ${eventType}`, err);
    }
  }

  async publishUserSignup(data: { userId: string; email: string; firstName: string; otp: number }): Promise<void> {
    await this.publish(EventType.USER_SIGNUP, data, { userId: data.userId });
  }

  async publishOrderCreated(orderData: { orderId: string }): Promise<void> {
    await this.publish(EventType.ORDER_CREATED, orderData);
  }

  async publishPaymentSuccessful(paymentData: {
    orderId: string;
    userId: string;
    paymentId: string;
    amount: number;
    paymentMethod: string;
    orderNumber?: string;
    customerInfo?: { email: string; name: string };
  }): Promise<void> {
    await this.publish(EventType.PAYMENT_SUCCESSFUL, paymentData, { userId: paymentData.userId });
  }

  async publishPriceChanged(
    productId: string,
    oldPrice: number,
    newPrice: number,
    discountPercentage?: number
  ): Promise<void> {
    await this.publish(EventType.PRICE_CHANGED, { productId, oldPrice, newPrice, discountPercentage });
  }

  async publishInventoryLow(
    productId: string,
    currentStock: number,
    threshold: number,
    productName: string
  ): Promise<void> {
    await this.publish(EventType.INVENTORY_LOW, { productId, currentStock, threshold, productName });
  }

  async publishOrderShipped(shipmentData: {
    orderId: string;
    userId: string;
    trackingNumber: string;
    shippingProvider: string;
    estimatedDelivery?: Date;
    customerInfo?: { email: string; name: string };
  }): Promise<void> {
    await this.publish(EventType.ORDER_SHIPPED, shipmentData, { userId: shipmentData.userId });
  }

  async publishNotification(notificationData: {
    userId?: string;
    email?: string;
    message: string;
    subject?: string;
    template?: string;
    templateData?: Record<string, unknown>;
  }): Promise<void> {
    await this.publish(EventType.NOTIFICATION_SEND, notificationData, { userId: notificationData.userId });
  }

  async publishBulkNotification(notificationData: {
    userIds?: string[];
    emails?: string[];
    message: string;
    subject?: string;
    template?: string;
    templateData?: Record<string, unknown>;
  }): Promise<void> {
    await this.publish(EventType.BULK_NOTIFICATION, notificationData);
  }

  async publishOrderPaid(data: {
    orderId: string;
    userId: string;
    totalAmount: number;
    items: Array<{ productId: string; quantity: number; price: number }>;
  }): Promise<void> {
    await this.publish(EventType.ORDER_PAID, data, { userId: data.userId });
  }

  async publishOrderSuccessful(data: {
    orderId: string;
    userId: string;
    orderNumber: string;
    totalAmount: number;
    customerInfo: { firstName: string; lastName: string; email: string };
    items: Array<{ productId: string; quantity: number; price: number }>;
  }): Promise<void> {
    await this.publish(EventType.ORDER_SUCCESSFUL, data, { userId: data.userId });
  }

  async publishWebsocketOrderUpdate(data: { orderId: string; status: string; message?: string }): Promise<void> {
    await this.publish(EventType.WEBSOCKET_ORDER_UPDATE, data);
  }

  async publishEmail(data: {
    userId?: string;
    email?: string;
    template: string;
    subject?: string;
    templateData?: Record<string, unknown>;
  }): Promise<void> {
    await this.publish(EventType.NOTIFY_EMAIL, data, { userId: data.userId });
  }

  async publishCouponRedeemed(data: {
    couponId: string;
    userId: string;
    orderId: string;
    amountDiscounted: number;
    code: string;
  }): Promise<void> {
    await this.publish(EventType.ADMIN_ACTION, { action: 'coupon.redeemed', ...data }, { userId: data.userId });
  }

  async publishShipmentCreated(data: {
    shipmentId: string;
    orderId: string;
    trackingNumber: string;
    status: string;
  }): Promise<void> {
    await this.publish(EventType.SHIPMENT_CREATED, data);
  }

  async publishShipmentStatusUpdated(data: {
    shipmentId: string;
    orderId: string;
    trackingNumber: string;
    oldStatus: string;
    newStatus: string;
    location?: string;
    description?: string;
  }): Promise<void> {
    await this.publish(EventType.SHIPMENT_STATUS_UPDATED, data);
  }
}

const eventPublisher = new EventPublisher();
export default eventPublisher;
