import { Types } from 'mongoose';
import Cart from '@/models/Cart';
import User from '@/models/User';
import { ITransaction } from '@/models/Transaction';
import LogisticsService from '@/services/LogisticsService';
import OrderService from '@/services/orderService';
import PaymentService from '@/services/TransactionService';
import {
  FrontendCartData,
  validateAndCorrectCart,
  FrontendCartItemInput,
  CorrectedCart,
  CartChangeDetail,
} from '@/services/CartValidationService';
import { OrderType } from '@/models/Order';
import { CustomResponseType } from '@/types';

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
};

export type SecureCheckoutCorrection = {
  needsUpdate: true;
  shippingCost: number;
  deliveryType: CheckoutDeliveryType;
  correctedCart: CorrectedCart;
  changes: string[];
  changeDetails: CartChangeDetail[];
};

export type SecureCheckoutSuccess = {
  orderId: string;
  order: {
    _id: string;
    total: number;
    subtotal: number;
    couponDiscount: number;
    shippingPrice: number;
    deliveryType: CheckoutDeliveryType;
    items: Array<{
      product: string;
      qty: number;
      price: number;
      attributes: Array<{ name: string; value: string }>;
      sale?: string;
      saleType?: string;
      saleDiscount?: number;
    }>;
    status: OrderType['status'];
    isPaid: boolean;
  };
  validation: {
    priceValidated: boolean;
    totalDiscrepancy: number;
  };
  payment: {
    paymentUrl: string;
    reference: string;
    transactionId: string;
  } | null;
};

class CheckoutService {
  public static async secureCheckout(
    userId: string,
    payload: SecureCheckoutPayload
  ): Promise<CustomResponseType<SecureCheckoutSuccess | SecureCheckoutCorrection>> {
    const {
      items,
      shippingAddress,
      paymentMethod = 'paystack',
      couponCodes,
      taxPrice = 0,
      subtotal,
      total,
      totalDiscount,
      estimatedShipping,
      deliveryType = 'shipping',
      shippingCost: frontendShippingCost,
    } = payload;

    if (!items || items.length === 0) {
      return {
        message: 'No items provided for checkout',
        data: null,
        code: 400,
      };
    }

    if (deliveryType === 'shipping' && !shippingAddress) {
      return {
        message: 'Shipping address is required for shipping delivery',
        data: null,
        code: 400,
      };
    }

    // Step 1: Calculate shipping cost up front
    let shippingCost = 0;
    if (deliveryType === 'shipping') {
      if (!shippingAddress) {
        return {
          message: 'Shipping address is required for shipping delivery',
          data: null,
          code: 400,
        };
      }

      const rawShippingCost = await LogisticsService.calculateProgressiveShipping(
        items.map((item) => ({
          productId: item.product.toString(),
          quantity: item.qty,
        })),
        {
          countryName: shippingAddress.country || 'Nigeria',
          stateName: shippingAddress.state || '',
          cityName: shippingAddress.city || undefined,
          lgaName: undefined,
        }
      );

      shippingCost = Math.round(rawShippingCost * 100) / 100;
    }

    const frontendCartData: FrontendCartData = {
      items,
      couponCodes: couponCodes || [],
      subtotal,
      total: total - shippingCost,
      totalDiscount,
      estimatedShipping: estimatedShipping || { cost: shippingCost, days: 0 },
    };

    const validationResult = await validateAndCorrectCart(frontendCartData, couponCodes);
    if (!validationResult.data) {
      return {
        message: 'Failed to validate cart data',
        data: null,
        code: 500,
      };
    }

    const correctedCart = validationResult.data.correctedCart;
    const changeDetails = [...validationResult.data.changeDetails];
    const changes = [...validationResult.data.changes];

    // Compare shipping cost with frontend provided value (if any)
    if (frontendShippingCost !== undefined && Math.abs((frontendShippingCost ?? 0) - shippingCost) > 0.01) {
      const message = `Shipping cost updated: ₦${(
        frontendShippingCost || 0
      ).toLocaleString()} → ₦${shippingCost.toLocaleString()}`;
      changes.push(message);
      changeDetails.push({
        field: 'shippingCost',
        previous: frontendShippingCost ?? 0,
        current: shippingCost,
        message,
        context: 'shipping',
      });
    }

    const expectedTotal = Math.round((total - (frontendShippingCost || 0) + shippingCost) * 100) / 100;

    if (validationResult.data.needsUpdate || Math.abs(total - expectedTotal) > 1) {
      await CheckoutService.syncServerCart(userId, correctedCart, shippingCost, deliveryType);

      return {
        message: 'Cart needs to be updated',
        data: {
          needsUpdate: true,
          shippingCost,
          deliveryType,
          correctedCart: {
            ...correctedCart,
            estimatedShipping: correctedCart.estimatedShipping || { cost: shippingCost, days: 0 },
          },
          changes,
          changeDetails,
        },
        code: 400,
      };
    }

    const backendCalculatedSubtotal = correctedCart.subtotal;
    const backendCouponDiscount = correctedCart.couponDiscount;
    const finalSubtotal = Math.round(backendCalculatedSubtotal * 100) / 100;
    const finalCouponDiscount = Math.round(backendCouponDiscount * 100) / 100;
    const finalTotal = Math.round((finalSubtotal - finalCouponDiscount + shippingCost) * 100) / 100;

    const orderInput = {
      user: userId,
      products: items.map((item) => ({
        product: item.product,
        qty: item.qty,
        price: item.unitPrice,
        attributes:
          item.selectedAttributes?.map((attr) => ({
            name: attr.name,
            value: attr.value,
          })) || [],
        sale: item.sale,
        saleType: undefined,
        saleDiscount: item.appliedDiscount || 0,
      })),
      shippingAddress: deliveryType === 'shipping' ? shippingAddress : undefined,
      deliveryType,
      paymentMethod,
      total: finalTotal,
      totalBeforeDiscount: finalSubtotal,
      couponCodes: couponCodes || [],
      couponDiscount: finalCouponDiscount,
      shippingPrice: shippingCost,
      taxPrice,
      isPaid: false,
      status: 'Pending' as OrderType['status'],
    } as unknown as Parameters<typeof OrderService.placeOrderWithStockValidation>[0];

    const placed = await OrderService.placeOrderWithStockValidation(orderInput);
    if (!placed.data) {
      return {
        message: placed.message,
        data: null,
        code: placed.code,
      };
    }

    const userDoc = await User.findById(userId).select('email');
    if (!userDoc?.email) {
      return {
        message: 'User email not found for payment initialization',
        data: null,
        code: 400,
      };
    }

    const order = placed.data.order;
    const orderId = (order as unknown as { _id: { toString(): string } })._id.toString();

    const paymentInit = await PaymentService.initializePayment({
      orderId,
      userId,
      email: userDoc.email,
      amount: finalTotal,
      currency: 'NGN',
      metadata: {
        source: 'secure-checkout',
        validated: true,
        itemCount: items.length,
        subtotal: finalSubtotal,
        couponDiscount: finalCouponDiscount,
        shippingCost,
        deliveryType,
        total: finalTotal,
      },
    });

    if (paymentInit.code !== 200) {
      return {
        message: paymentInit.message,
        data: null,
        code: paymentInit.code,
      };
    }

    const responseItems = items.map((item) => ({
      product: item.product,
      qty: item.qty,
      price: item.unitPrice,
      attributes: item.selectedAttributes || [],
      sale: item.sale,
      saleType: undefined,
      saleDiscount: item.appliedDiscount ?? 0,
    }));

    const paymentData = paymentInit.data;
    const paymentPayload = paymentData
      ? (() => {
          const transaction = paymentData.transaction as ITransaction | undefined;
          const transactionId = transaction && transaction._id ? transaction._id.toString() : '';
          return {
            paymentUrl: paymentData.paymentUrl,
            reference: paymentData.reference,
            transactionId,
          };
        })()
      : null;

    return {
      message: 'Secure checkout completed successfully',
      data: {
        orderId,
        order: {
          _id: orderId,
          total: finalTotal,
          subtotal: finalSubtotal,
          couponDiscount: finalCouponDiscount,
          shippingPrice: shippingCost,
          deliveryType,
          items: responseItems,
          status: 'Pending',
          isPaid: false,
        },
        validation: {
          priceValidated: true,
          totalDiscrepancy: 0,
        },
        payment: paymentPayload,
      },
      code: 200,
    };
  }

  private static async syncServerCart(
    userId: string,
    correctedCart: CorrectedCart,
    shippingCost: number,
    deliveryType: CheckoutDeliveryType
  ): Promise<void> {
    const cartDoc = await Cart.findOne({ user: userId });
    if (!cartDoc) {
      return;
    }

    const mappedItems = correctedCart.items.map((item) => {
      const secureItem = item as SecureCheckoutItemInput;
      return {
        _id:
          secureItem._id && Types.ObjectId.isValid(secureItem._id) ? secureItem._id : new Types.ObjectId().toString(),
        product: secureItem.product,
        qty: secureItem.qty,
        selectedAttributes: secureItem.selectedAttributes || [],
        productSnapshot: secureItem.productSnapshot
          ? {
              name: secureItem.productSnapshot.name,
              price: secureItem.productSnapshot.price,
              sku: secureItem.productSnapshot.sku,
            }
          : {
              name: 'Product',
              price: secureItem.unitPrice,
              sku: secureItem.product,
            },
        unitPrice: secureItem.unitPrice,
        totalPrice: secureItem.totalPrice ?? secureItem.unitPrice * secureItem.qty,
        sale: secureItem.sale || undefined,
        saleVariantIndex: secureItem.saleVariantIndex,
        appliedDiscount: secureItem.appliedDiscount ?? 0,
        discountAmount: secureItem.discountAmount ?? 0,
        pricingTier: secureItem.pricingTier,
        addedAt: new Date(),
      };
    });

    const mappedCoupons = (correctedCart.validatedCoupons || []).map((coupon) => ({
      coupon: coupon.couponId,
      code: coupon.code,
      discountAmount: coupon.discountAmount,
      appliedAt: new Date(),
    }));

    cartDoc.set({
      items: mappedItems,
      subtotal: correctedCart.subtotal,
      totalDiscount: correctedCart.totalDiscount ?? correctedCart.couponDiscount,
      total: correctedCart.total,
      estimatedShipping: correctedCart.estimatedShipping || { cost: shippingCost, days: 0 },
      status: 'active',
      appliedCoupons: mappedCoupons,
      lastActivity: new Date(),
    });

    if (deliveryType === 'pickup') {
      cartDoc.set('estimatedShipping', { cost: 0, days: 0 });
    }

    cartDoc.markModified('items');
    cartDoc.markModified('appliedCoupons');
    cartDoc.markModified('estimatedShipping');

    await cartDoc.save();
  }
}

export default CheckoutService;
