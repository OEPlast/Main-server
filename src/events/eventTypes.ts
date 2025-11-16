export enum EventType {
  // User events
  USER_SIGNUP = 'user.signup',
  USER_LOGIN = 'user.login',
  USER_PROFILE_UPDATED = 'user.profile.updated',

  // Order events
  ORDER_CREATED = 'order.created',
  ORDER_SUCCESSFUL = 'order.successful',
  ORDER_UPDATED = 'order.updated',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
  ORDER_PAID = 'order.paid',

  // Payment events
  PAYMENT_SUCCESSFUL = 'payment.successful',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',

  // Product events
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',
  PRODUCT_DELETED = 'product.deleted',
  PRICE_CHANGED = 'product.price.changed',

  // Inventory events
  INVENTORY_LOW = 'inventory.low',
  INVENTORY_OUT_OF_STOCK = 'inventory.out_of_stock',
  INVENTORY_RESTOCKED = 'inventory.restocked',

  // Campaign events
  CAMPAIGN_CREATED = 'campaign.created',
  CAMPAIGN_STARTED = 'campaign.started',
  CAMPAIGN_ENDED = 'campaign.ended',

  // Review events
  REVIEW_CREATED = 'review.created',
  REVIEW_UPDATED = 'review.updated',

  // Admin events
  ADMIN_ACTION = 'admin.action',
  BULK_NOTIFICATION = 'admin.bulk_notification',

  // File upload events
  FILE_UPLOADED = 'file.uploaded',
  FILE_DELETED = 'file.deleted',

  // Shipment events
  SHIPMENT_CREATED = 'shipment.created',
  SHIPMENT_STATUS_UPDATED = 'shipment.status.updated',

  // Real-time events
  NOTIFICATION_SEND = 'notification.send',
  DATA_SYNC = 'data.sync',
  WEBSOCKET_ORDER_UPDATE = 'realtime.order.update',
  NOTIFY_EMAIL = 'email.send',
}

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  source: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  data?: unknown;
}

export interface UserSignupEvent extends BaseEvent {
  type: EventType.USER_SIGNUP;
  data: {
    userId: string;
    email: string;
    firstName: string;
    lastName?: string;
  };
}

export interface OrderCreatedEvent extends BaseEvent {
  type: EventType.ORDER_CREATED;
  data: {
    orderId: string;
    userId: string;
    orderNumber: string;
    totalAmount: number;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    customerInfo: {
      email: string;
      name: string;
      phone?: string;
    };
  };
}

export interface PaymentSuccessfulEvent extends BaseEvent {
  type: EventType.PAYMENT_SUCCESSFUL;
  data: {
    orderId: string;
    userId: string;
    paymentId: string;
    amount: number;
    paymentMethod: string;
  };
}

export interface PriceChangedEvent extends BaseEvent {
  type: EventType.PRICE_CHANGED;
  data: {
    productId: string;
    oldPrice: number;
    newPrice: number;
    discountPercentage?: number;
  };
}

export interface InventoryLowEvent extends BaseEvent {
  type: EventType.INVENTORY_LOW;
  data: {
    productId: string;
    currentStock: number;
    threshold: number;
    productName: string;
  };
}

export interface OrderShippedEvent extends BaseEvent {
  type: EventType.ORDER_SHIPPED;
  data: {
    orderId: string;
    userId: string;
    trackingNumber: string;
    shippingProvider: string;
    estimatedDelivery?: Date;
  };
}

export interface NotificationEvent extends BaseEvent {
  type: EventType.NOTIFICATION_SEND;
  data: {
    userId?: string;
    email?: string;
    message: string;
    subject?: string;
    template?: string;
    templateData?: Record<string, unknown>;
  };
}

export interface BulkNotificationEvent extends BaseEvent {
  type: EventType.BULK_NOTIFICATION;
  data: {
    userIds?: string[];
    emails?: string[];
    message: string;
    subject?: string;
    template?: string;
    templateData?: Record<string, unknown>;
  };
}

export interface OrderPaidEvent extends BaseEvent {
  type: EventType.ORDER_PAID;
  data: {
    orderId: string;
    userId: string;
    totalAmount: number;
    items: Array<{ productId: string; quantity: number; price: number }>;
  };
}

export type EventData =
  | UserSignupEvent
  | OrderCreatedEvent
  | PaymentSuccessfulEvent
  | PriceChangedEvent
  | InventoryLowEvent
  | OrderShippedEvent
  | NotificationEvent
  | BulkNotificationEvent
  | OrderPaidEvent
  | BaseEvent;
