import amqplib from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { EventType, BaseEvent } from './eventTypes';

interface AmqpLikeChannel {
  assertExchange: (exchange: string, type: string, options?: Record<string, unknown>) => Promise<unknown>;
  publish: (exchange: string, routingKey: string, content: Buffer, options?: Record<string, unknown>) => boolean;
  close: () => Promise<void>;
}

interface AmqpLikeConnection {
  createChannel: () => Promise<AmqpLikeChannel>;
  close: () => Promise<void>;
}

class EventPublisher {
  private connection: unknown = null;
  private channel: unknown = null;
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      const rawConnection = await amqplib.connect(rabbitmqUrl);
      const connection = rawConnection as unknown as AmqpLikeConnection;
      const channel = (await connection.createChannel()) as AmqpLikeChannel;

      this.connection = connection;
      this.channel = channel;

      await channel.assertExchange('events', 'topic', { durable: true });
      await channel.assertExchange('notifications', 'direct', { durable: true });
      await channel.assertExchange('realtime', 'fanout', { durable: false });

      this.isConnected = true;
      console.log('EventPublisher connected to RabbitMQ');
    } catch (error) {
      console.error('Failed to connect EventPublisher to RabbitMQ:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const channel = this.channel as AmqpLikeChannel | null;
      if (channel) {
        await channel.close();
      }

      const connection = this.connection as AmqpLikeConnection | null;
      if (connection) {
        await connection.close();
      }

      this.isConnected = false;
      console.log('EventPublisher disconnected from RabbitMQ');
    } catch (error) {
      console.error('Error disconnecting EventPublisher:', error);
    }
  }

  async publishEvent(eventType: EventType, data: unknown, userId?: string): Promise<void> {
    if (!this.isConnected || !this.channel) {
      console.error('EventPublisher not connected to RabbitMQ');
      return;
    }

    try {
      const event: BaseEvent = {
        id: uuidv4(),
        type: eventType,
        timestamp: new Date(),
        source: 'main-server',
        userId,
        data: data as Record<string, unknown>,
      };

      const exchange = this.getExchange(eventType);
      const routingKey = this.getRoutingKey(eventType);

      const channel = this.channel as AmqpLikeChannel;
      channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)), {
        persistent: true,
        messageId: event.id,
        timestamp: event.timestamp.getTime(),
        headers: {
          eventType: eventType,
          source: 'main-server',
        },
      });

      console.log(`Event published: ${eventType} with ID: ${event.id}`);
    } catch (error) {
      console.error(`Failed to publish event ${eventType}:`, error);
    }
  }

  private getExchange(eventType: EventType): string {
    if (eventType.includes('notification') || eventType.includes('email')) {
      return 'notifications';
    } else if (eventType.includes('realtime') || eventType.includes('live')) {
      return 'realtime';
    }
    return 'events';
  }

  private getRoutingKey(eventType: EventType): string {
    const parts = eventType.split('.');
    return parts.join('.');
  }

  async publishUserSignup(userId: string, email: string, firstName: string, lastName?: string): Promise<void> {
    await this.publishEvent(
      EventType.USER_SIGNUP,
      {
        userId,
        email,
        firstName,
        lastName,
      },
      userId
    );
  }

  async publishOrderCreated(orderData: {
    orderId: string;
    userId: string;
    orderNumber: string;
    totalAmount: number;
    items: Array<{ productId: string; quantity: number; price: number }>;
    customerInfo: { email: string; name: string; phone?: string };
  }): Promise<void> {
    await this.publishEvent(EventType.ORDER_CREATED, orderData, orderData.userId);
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
    await this.publishEvent(EventType.PAYMENT_SUCCESSFUL, paymentData, paymentData.userId);
  }

  async publishPriceChanged(
    productId: string,
    oldPrice: number,
    newPrice: number,
    discountPercentage?: number
  ): Promise<void> {
    await this.publishEvent(EventType.PRICE_CHANGED, {
      productId,
      oldPrice,
      newPrice,
      discountPercentage,
    });
  }

  async publishInventoryLow(
    productId: string,
    currentStock: number,
    threshold: number,
    productName: string
  ): Promise<void> {
    await this.publishEvent(EventType.INVENTORY_LOW, {
      productId,
      currentStock,
      threshold,
      productName,
    });
  }

  async publishOrderShipped(shipmentData: {
    orderId: string;
    userId: string;
    trackingNumber: string;
    shippingProvider: string;
    estimatedDelivery?: Date;
    customerInfo?: { email: string; name: string };
  }): Promise<void> {
    await this.publishEvent(EventType.ORDER_SHIPPED, shipmentData, shipmentData.userId);
  }

  async publishNotification(notificationData: {
    userId?: string;
    email?: string;
    message: string;
    subject?: string;
    template?: string;
    templateData?: Record<string, unknown>;
  }): Promise<void> {
    await this.publishEvent(EventType.NOTIFICATION_SEND, notificationData, notificationData.userId);
  }

  async publishBulkNotification(notificationData: {
    userIds?: string[];
    emails?: string[];
    message: string;
    subject?: string;
    template?: string;
    templateData?: Record<string, unknown>;
  }): Promise<void> {
    await this.publishEvent(EventType.BULK_NOTIFICATION, notificationData);
  }

  async publishOrderPaid(data: {
    orderId: string;
    userId: string;
    totalAmount: number;
    items: Array<{ productId: string; quantity: number; price: number }>;
  }): Promise<void> {
    await this.publishEvent(EventType.ORDER_PAID, data, data.userId);
  }

  async publishWebsocketOrderUpdate(data: { orderId: string; status: string; message?: string }): Promise<void> {
    await this.publishEvent(EventType.WEBSOCKET_ORDER_UPDATE, data);
  }

  async publishEmail(data: {
    userId?: string;
    email?: string;
    template: string;
    subject?: string;
    templateData?: Record<string, unknown>;
  }): Promise<void> {
    await this.publishEvent(EventType.NOTIFY_EMAIL, data, data.userId);
  }

  async publishCouponRedeemed(data: {
    couponId: string;
    userId: string;
    orderId: string;
    amountDiscounted: number;
    code: string;
  }): Promise<void> {
    await this.publishEvent(EventType.ADMIN_ACTION as unknown as EventType, {
      action: 'coupon.redeemed',
      ...data,
    });
  }
}

const eventPublisher = new EventPublisher();
export default eventPublisher;
