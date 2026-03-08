import mongoose from 'mongoose';
import { CouponType as CouponSchemaType } from '@/models/Coupon';
import { FrontendCartItemInput } from '@/services/CartValidationService';
import { OrderType } from '@/models/Order';

export type CheckoutDeliveryType = 'shipping' | 'pickup';

export type SecureCheckoutItemInput = FrontendCartItemInput & {
  productSnapshot?: {
    name: string;
    price: number;
    sku: string | number;
  };
  saleVariantIndex?: number;
  pricingTier?: {
    minQty: number;
    maxQty?: number;
    strategy: string;
    value: number;
    appliedPrice?: number;
  };
};

export type SecureCheckoutPayload = {
  items: SecureCheckoutItemInput[];
  shippingAddress?: OrderType['shippingAddress'];
  paymentMethod?: string;
  couponCodes?: string[];
  taxPrice?: number;
  subtotal: number;
  total: number;
  totalDiscount: number;
  estimatedShipping?: { cost: number; days: number };
  deliveryType?: CheckoutDeliveryType;
  shippingCost?: number;
  acceptChanges?: boolean; // Auto-apply corrections when true
  notes?: string;
};

export type SecureCheckoutCorrection = {
  needsUpdate: true;
  errors?: {
    products?: Array<{
      productId: string;
      productName: string;
      productSlug: string;
      cartItemId: string;
      issueType: 'outOfStock' | 'quantityReduced' | 'priceChanged' | 'attributeUnavailable' | 'saleExpired';
      message: string;
      severity: 'critical' | 'warning' | 'info';
      currentQty: number;
      availableStock: number;
      currentPrice: number | null;
      correctedPrice: number | null;
      unavailableAttributes: Array<{ name: string; value: string }> | null;
      availableAttributes: Array<Array<{ name: string; value: string }>> | null;
      suggestedAction: 'remove' | 'reduceQuantity' | 'changeAttribute' | 'acceptPrice';
      saleInfo?: {
        previousSaleId: string;
        previousDiscount: number;
        expiryReason: 'endDateReached' | 'maxBuysReached' | 'deactivated';
      };
    }>;
    coupons?: Array<{
      code: string;
      reason: string;
      previousDiscount: number;
      expiryDate?: string;
    }>;
    shipping?: {
      previousCost: number;
      currentCost: number;
      reason: string;
      destination?: {
        state: string;
        city?: string;
      };
    };
    total?: {
      expectedTotal: number;
      calculatedTotal: number;
      discrepancy: number;
      message: string;
    };
  };
  summary: {
    itemsRemaining: number;
    newSubtotal: number;
    newTotal: number;
    shippingCost: number;
    deliveryType: CheckoutDeliveryType;
    couponDiscount: number;
  };
};

export type SecureCheckoutSuccess = {
  orderId: string;
  payment: {
    paymentUrl: string;
    reference: string;
    transactionId: string;
    access_code: string;
  } | null;
  summary: {
    total: number;
    subtotal: number;
    couponDiscount: number;
    shippingCost: number;
    itemCount: number;
    deliveryType: CheckoutDeliveryType;
  };
};

export type CouponDoc = CouponSchemaType & { _id: mongoose.Types.ObjectId };

export type PricedItem = {
  product: mongoose.Types.ObjectId | string;
  qty: number;
  price: number;
};

// Accept user as string (will be cast by Mongoose) or ObjectId
// Make array fields optional for input ergonomics
export type OrderDataInput = Omit<OrderType, 'createdAt' | 'updatedAt' | 'user' | 'flashSaleApplied'> & {
  user: string | mongoose.Types.ObjectId;
  flashSaleApplied?: OrderType['flashSaleApplied'];
  couponCodes?: string[]; // Add support for coupon codes array
};

// Enhanced order response type that includes additional order creation details
export type PlaceOrderResponse = {
  order: OrderType;
  couponResults: Array<{ code: string; applied: boolean; reason?: string; discount?: number }>;
  appliedCoupons: number;
  totalCouponDiscount: number;
};
