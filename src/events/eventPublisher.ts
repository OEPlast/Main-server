import amqplib, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { EventType, type BaseEvent } from './eventTypes';
import type {
  OrderCancelledData,
  OrderConfirmationData,
  OrderDeliveredData,
  OrderRefundedData,
  OrderShippedData,
  PaymentFailedData,
  PaymentReceiptData,
  VerificationEmailData,
} from '@/types/emailPayloads';

// Simplified: single topic exchange. Consumers can bind a queue with patterns (e.g. order.*, payment.#, #)
const EXCHANGE_NAME = 'app.events';

/** Events waiting for a connection. Bounded so a long outage cannot exhaust memory. */
const MAX_PENDING = 2000;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

type PendingEvent = { event: BaseEvent; attempts: number };

/**
 * Publishes domain events to RabbitMQ.
 *
 * Reliability, which the first version lacked entirely:
 *  - a confirm channel, so publish() resolves only once the broker has taken the message;
 *  - automatic reconnection with backoff when the connection drops (before, a dropped connection
 *    meant every later event was logged as "dropping event" until the process restarted);
 *  - events published while disconnected wait in a bounded queue and go out on reconnect, in order.
 */
class EventPublisher {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private isConnected = false;
  private connecting: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay = RECONNECT_MIN_MS;
  private closing = false;
  private readonly pending: PendingEvent[] = [];

  async connect(): Promise<void> {
    if (this.isConnected) return; // idempotent
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      try {
        const connection = await amqplib.connect(rabbitmqUrl);
        const channel = await connection.createConfirmChannel();
        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

        this.connection = connection;
        this.channel = channel;
        this.isConnected = true;
        this.reconnectDelay = RECONNECT_MIN_MS;
        logger.info('[events] connected');

        connection.on('close', () => this.onConnectionLost('connection closed'));
        connection.on('error', (err: unknown) => logger.error('[events] connection error', err));
        channel.on('error', (err: unknown) => logger.error('[events] channel error', err));

        await this.flushPending();
      } catch (err) {
        logger.error(`[events] failed to connect: ${(err as Error).message}`);
        this.scheduleReconnect();
        throw err;
      } finally {
        this.connecting = null;
      }
    })();
    return this.connecting;
  }

  private onConnectionLost(reason: string): void {
    this.isConnected = false;
    this.channel = null;
    this.connection = null;
    if (this.closing) return;
    logger.warn(`[events] ${reason}; reconnecting`);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        /* scheduleReconnect already re-armed */
      });
    }, delay);
    this.reconnectTimer.unref?.();
  }

  /** For health checks — RabbitMQ is connected non-blockingly at startup, so this reports it rather than gating readiness on it. */
  isRabbitMQConnected(): boolean {
    return this.isConnected;
  }

  /** Events queued while disconnected. Exposed for /health. */
  pendingCount(): number {
    return this.pending.length;
  }

  private enqueue(event: BaseEvent): void {
    if (this.pending.length >= MAX_PENDING) {
      const dropped = this.pending.shift();
      logger.error(`[events] pending queue full; dropped ${dropped?.event.type} id=${dropped?.event.id}`);
    }
    this.pending.push({ event, attempts: 0 });
  }

  private async flushPending(): Promise<void> {
    while (this.pending.length > 0 && this.channel) {
      const next = this.pending[0];
      try {
        await this.send(next.event);
        this.pending.shift();
      } catch (err) {
        next.attempts += 1;
        logger.error(`[events] replay of ${next.event.type} failed (attempt ${next.attempts})`, err);
        if (next.attempts >= 5) this.pending.shift();
        return;
      }
    }
    if (this.pending.length === 0) return;
  }

  /** Publishes on the confirm channel and resolves once the broker acknowledges the message. */
  private send(event: BaseEvent): Promise<void> {
    const channel = this.channel;
    if (!channel) return Promise.reject(new Error('not connected'));
    const payload = Buffer.from(JSON.stringify(event));
    return new Promise<void>((resolve, reject) => {
      channel.publish(
        EXCHANGE_NAME,
        event.type,
        payload,
        {
          contentType: 'application/json',
          persistent: true,
          messageId: event.id,
          timestamp: event.timestamp.getTime(),
          type: event.type,
          headers: { source: event.source },
        },
        (err) => (err ? reject(err) : resolve())
      );
    });
  }

  /** Stops reconnecting, gives queued events a moment to drain, then closes. For shutdown. */
  async disconnect(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      if (this.isConnected) await this.flushPending();
      if (this.pending.length > 0) {
        logger.error(`[events] shutting down with ${this.pending.length} unsent events`);
      }
      await this.channel?.close();
      await this.connection?.close();
    } catch (err) {
      logger.error('[events] disconnect error', err);
    } finally {
      this.isConnected = false;
      this.channel = null;
      this.connection = null;
    }
  }

  async publish(
    eventType: EventType,
    data: Record<string, unknown> = {},
    opts?: { userId?: string; source?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: eventType,
      timestamp: new Date(),
      source: opts?.source || 'main-server',
      userId: opts?.userId,
      metadata: opts?.metadata,
      data,
    };

    if (!this.isConnected || !this.channel) {
      this.enqueue(event);
      logger.warn(`[events] not connected; queued ${eventType} id=${event.id} (${this.pending.length} pending)`);
      this.connect().catch(() => {
        /* reconnect is scheduled */
      });
      return;
    }

    // Keep ordering: nothing goes out ahead of events still waiting from an outage.
    if (this.pending.length > 0) {
      this.enqueue(event);
      await this.flushPending();
      return;
    }

    try {
      await this.send(event);
      logger.debug(`[events] published ${eventType} id=${event.id}`);
    } catch (err) {
      logger.error(`[events] failed to publish ${eventType}; queued for retry`, err);
      this.enqueue(event);
    }
  }

  async publishUserSignup(data: VerificationEmailData & Record<string, unknown>): Promise<void> {
    await this.publish(EventType.USER_SIGNUP, data);
  }

  async publishOrderCreated(orderData: { orderId: string }): Promise<void> {
    await this.publish(EventType.ORDER_CREATED, orderData);
  }

  async publishPaymentSuccessful(
    paymentData: Partial<PaymentReceiptData> & {
      orderId: string;
      userId: string;
      paymentId: string;
      amount: number;
      paymentMethod: string;
      orderNumber?: string;
      customerInfo?: { email: string; name: string };
    }
  ): Promise<void> {
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

  async publishInventoryOutOfStock(productId: string, productName: string, lastQuantity: number = 0): Promise<void> {
    await this.publish(EventType.INVENTORY_OUT_OF_STOCK, { productId, productName, lastQuantity });
  }

  async publishProductUpdated(productId: string, name: string, price: number, stock: number): Promise<void> {
    await this.publish(EventType.PRODUCT_UPDATED, { productId, name, price, stock });
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

  async publishOrderSuccessful(data: OrderConfirmationData): Promise<void> {
    await this.publish(EventType.ORDER_SUCCESSFUL, data as unknown as Record<string, unknown>);
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

  async publishShipmentStatusUpdated(data: OrderShippedData): Promise<void> {
    await this.publish(EventType.SHIPMENT_STATUS_UPDATED, data as unknown as Record<string, unknown>);
  }

  async publishOrderDelivered(data: OrderDeliveredData & { shipmentId: string }): Promise<void> {
    await this.publish(EventType.ORDER_DELIVERED, data as unknown as Record<string, unknown>);
  }

  /**
   * Cancellation, carrying everything the email needs.
   *
   * ORDER_CANCELLED was in the enum from the start and was never published by anything, so
   * the order-cancelled template sat unused and customers were never told.
   */
  async publishOrderCancelled(data: OrderCancelledData & { userId: string }): Promise<void> {
    await this.publish(EventType.ORDER_CANCELLED, data as unknown as Record<string, unknown>, {
      userId: data.userId,
    });
  }

  /** Refund issued and money sent. Feeds the order-refunded email. */
  async publishPaymentRefunded(
    data: OrderRefundedData & { userId: string; refundId: string; originalPaymentId: string }
  ): Promise<void> {
    await this.publish(EventType.PAYMENT_REFUNDED, data as unknown as Record<string, unknown>, {
      userId: data.userId,
    });
  }

  /**
   * Payment attempt failed.
   *
   * Previously published with only an orderId, userId and reference, which is why nothing
   * downstream could tell the customer what had happened or offer them a retry.
   */
  async publishPaymentFailed(data: PaymentFailedData & { userId: string; reference?: string }): Promise<void> {
    await this.publish(EventType.PAYMENT_FAILED, data as unknown as Record<string, unknown>, {
      userId: data.userId,
    });
  }
}

const eventPublisher = new EventPublisher();
export default eventPublisher;
