import { Types } from 'mongoose';
import mongoose from 'mongoose';
import Cart from '@/models/Cart';
import User from '@/models/User';
import Product from '@/models/Product';
import { ITransaction } from '@/models/Transaction';
import LogisticsService from '@/services/LogisticsService';
import GIGService from '@/services/GIGService';
import OrderService from '@/services/orderService';
import PaymentService from '@/services/TransactionService';
import { FrontendCartData, validateAndCorrectCart, CorrectedCart } from '@/services/CartValidationService';
import Order, { OrderType } from '@/models/Order';
import { CustomResponseType } from '@/types';
import { reverseSaleCountersOnCancel } from '@/helpers/saleOrderUtils';
import eventPublisher from '@/events/eventPublisher';
import { orderStatusUpdate } from '@/utils/orderStatusTimestamps';
import type {
  CheckoutDeliveryType,
  SecureCheckoutItemInput,
  SecureCheckoutPayload,
  SecureCheckoutCorrection,
  SecureCheckoutSuccess,
  OrderDataInput,
} from '@/types/order';

// Re-export types for backward compatibility with existing imports
export type {
  CheckoutDeliveryType,
  SecureCheckoutItemInput,
  SecureCheckoutPayload,
  SecureCheckoutCorrection,
  SecureCheckoutSuccess,
} from '@/types/order';

class CheckoutService {
  /**
   * Apply product corrections to cart items based on validation errors
   * @param items - Original cart items
   * @param checkoutErrors - Validation errors from CartValidationService
   * @returns Corrected items array with removed/reduced quantities
   */
  private static applyProductCorrections(
    items: SecureCheckoutItemInput[],
    checkoutErrors: SecureCheckoutCorrection['errors']
  ): SecureCheckoutItemInput[] {
    if (!checkoutErrors?.products || checkoutErrors.products.length === 0) {
      return items;
    }

    const correctedItems: SecureCheckoutItemInput[] = [];

    for (const item of items) {
      const itemId = item._id?.toString() || item.product.toString();
      const error = checkoutErrors.products.find(
        (err) => err.cartItemId === itemId || err.productId === item.product.toString()
      );

      if (!error) {
        // No error for this item - keep as-is
        correctedItems.push(item);
        continue;
      }

      // Apply correction based on suggestedAction
      switch (error.suggestedAction) {
        case 'remove':
          // Skip this item (don't add to correctedItems)
          console.log(`[CheckoutService] Removing item ${itemId} (${error.message})`);
          break;

        case 'reduceQuantity':
          if (error.availableStock > 0) {
            correctedItems.push({
              ...item,
              qty: error.availableStock,
            });
            console.log(`[CheckoutService] Reduced item ${itemId} quantity: ${item.qty} → ${error.availableStock}`);
          } else {
            console.log(`[CheckoutService] Removing item ${itemId} (no stock available)`);
          }
          break;

        case 'acceptPrice':
        case 'changeAttribute':
          // Keep item as-is - price/attribute will be corrected by validation
          correctedItems.push(item);
          console.log(`[CheckoutService] Keeping item ${itemId} with ${error.suggestedAction}`);
          break;

        default:
          // Unknown action - keep item to be safe
          correctedItems.push(item);
          console.warn(`[CheckoutService] Unknown suggestedAction for item ${itemId}: ${error.suggestedAction}`);
      }
    }

    return correctedItems;
  }

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
      acceptChanges = false,
    } = payload;

    if (!items || items.length === 0) {
      return {
        message: 'No items provided for checkout',
        data: null,
        code: 400,
      };
    }

    const checkoutConfigResult = await GIGService.getPublicCheckoutConfig();
    const { enabledDeliveryMethods, shippingDiscountAmountOff } = checkoutConfigResult.data;

    if (!enabledDeliveryMethods.includes(deliveryType)) {
      return {
        message: `${deliveryType} delivery is currently unavailable`,
        data: null,
        code: 400,
      };
    }

    if ((deliveryType === 'shipping' || deliveryType === 'gig') && !shippingAddress) {
      return {
        message: 'Shipping address is required for delivery',
        data: null,
        code: 400,
      };
    }

    // Step 1: Calculate shipping cost up front
    let shippingCost = 0;
    if (deliveryType === 'shipping' && shippingAddress) {
      const rawShippingCost = await LogisticsService.calculateProgressiveShipping(
        items.map((item) => ({
          productId: item.product.toString(),
          quantity: item.qty,
        })),
        {
          countryName: shippingAddress.country || 'Nigeria',
          stateName: shippingAddress.state || '',
          cityName: shippingAddress.city || undefined,
          lgaName: shippingAddress.lga || undefined,
        }
      );

      const discountedShipping = GIGService.applyDeliveryDiscount(rawShippingCost, shippingDiscountAmountOff);
      shippingCost = Math.round(discountedShipping.finalAmount * 100) / 100;
    } else if (deliveryType === 'gig' && shippingAddress) {
      // GIG shipping: calculate via GIG API
      const products = await Product.find({
        _id: { $in: items.map((i) => i.product) },
      })
        .select('name weight height width length isVolumetric description_images')
        .lean();

      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      const gigItems = items.map((item) => {
        const prod = productMap.get(item.product.toString());
        return {
          name: prod?.name || 'Product',
          quantity: item.qty,
          weight: prod?.weight ?? 1,
          height: prod?.height ?? 10,
          width: prod?.width ?? 10,
          length: prod?.length ?? 10,
          isVolumetric: prod?.isVolumetric ?? false,
          value: item.unitPrice || 0,
          imageUrl: prod?.description_images?.find((img: { cover_image?: boolean }) => img.cover_image)?.url || '',
        };
      });

      const gigResult = await GIGService.calculateShipping({
        items: gigItems,
        receiverAddress: shippingAddress.address1 || '',
        receiverState: shippingAddress.state || '',
        receiverCity: shippingAddress.city || undefined,
        receiverLatitude: (shippingAddress as Record<string, unknown>).latitude as number | undefined,
        receiverLongitude: (shippingAddress as Record<string, unknown>).longitude as number | undefined,
        receiverName: `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim(),
        receiverPhoneNumber: shippingAddress.phoneNumber || '',
      });

      if (!gigResult.data) {
        return {
          message:
            gigResult.message || 'GIG shipping is temporarily unavailable. Please select another shipping method.',
          data: null,
          code: 503,
        };
      }

      shippingCost = Math.round(gigResult.data.shippingCost * 100) / 100;
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

    // Get checkoutErrors from validation result (includes products and coupons)
    const checkoutErrors = validationResult.data.checkoutErrors || {};

    // Compare shipping cost with frontend provided value (if any)
    if (frontendShippingCost !== undefined && Math.abs((frontendShippingCost ?? 0) - shippingCost) > 0.01) {
      checkoutErrors.shipping = {
        previousCost: frontendShippingCost ?? 0,
        currentCost: shippingCost,
        reason: 'Shipping rate updated for your location',
        destination: shippingAddress
          ? {
              state: shippingAddress.state || '',
              city: shippingAddress.city || undefined,
            }
          : undefined,
      };
    }

    const expectedTotal = Math.round((total - (frontendShippingCost || 0) + shippingCost) * 100) / 100;

    if (validationResult.data.needsUpdate || Math.abs(total - expectedTotal) > 1) {
      // Check for total-only discrepancy (no other errors)
      const hasOtherErrors = checkoutErrors.products || checkoutErrors.coupons || checkoutErrors.shipping;

      if (!hasOtherErrors && Math.abs(total - expectedTotal) > 1) {
        // Total mismatch with no other errors - this is a blocking error
        return {
          message: 'Order total verification failed',
          data: {
            needsUpdate: true,
            errors: {
              total: {
                expectedTotal: total,
                calculatedTotal: expectedTotal,
                discrepancy: Math.abs(total - expectedTotal),
                message: 'Order total verification failed. Please refresh and try again.',
              },
            },
            summary: {
              itemsRemaining: correctedCart.items.length,
              newSubtotal: correctedCart.subtotal,
              newTotal: correctedCart.subtotal - correctedCart.couponDiscount + shippingCost,
              shippingCost,
              deliveryType,
              couponDiscount: correctedCart.couponDiscount,
            },
          } as SecureCheckoutCorrection,
          code: 400,
        };
      }

      // If acceptChanges=true, apply corrections and retry
      if (acceptChanges && checkoutErrors.products && checkoutErrors.products.length > 0) {
        const correctedItems = CheckoutService.applyProductCorrections(items, checkoutErrors);

        if (correctedItems.length === 0) {
          return {
            message: 'All items removed from cart due to validation errors',
            data: null,
            code: 400,
          };
        }

        console.log(
          `[CheckoutService] Retrying checkout with ${correctedItems.length}/${items.length} items after corrections`
        );

        // Recursively call secureCheckout with corrected items (but don't accept changes again)
        return CheckoutService.secureCheckout(userId, {
          ...payload,
          items: correctedItems,
          acceptChanges: false, // Don't loop infinitely
        });
      }

      await CheckoutService.syncServerCart(userId, correctedCart, shippingCost, deliveryType);

      return {
        message: 'Cart needs to be updated',
        data: {
          needsUpdate: true,
          errors: Object.keys(checkoutErrors).length > 0 ? checkoutErrors : undefined,
          summary: {
            itemsRemaining: correctedCart.items.length,
            newSubtotal: correctedCart.subtotal,
            newTotal: correctedCart.subtotal - correctedCart.couponDiscount + shippingCost,
            shippingCost,
            deliveryType,
            couponDiscount: correctedCart.couponDiscount,
          },
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
      // Use server-corrected pricing from CartValidationService
      products: correctedCart.items.map((correctedItem) => ({
        product: correctedItem.product,
        qty: correctedItem.qty,
        price: correctedItem.unitPrice, // Server-calculated unit price
        attributes:
          correctedItem.selectedAttributes?.map((attr) => ({
            name: attr.name,
            value: attr.value,
          })) || [],
        sale: correctedItem.sale,
        saleType: undefined,
        saleDiscount: correctedItem.appliedDiscount || 0,
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
      notes: payload.notes,
    } as unknown as OrderDataInput;

    const userDoc = await User.findById(userId).select('email');
    if (!userDoc?.email) {
      return {
        message: 'User email not found for payment initialization',
        data: null,
        code: 400,
      };
    }

    const placed = await OrderService.placeOrderWithStockValidation(orderInput);
    if (!placed.data) {
      return {
        message: placed.message,
        data: null,
        code: placed.code,
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
      await Order.findByIdAndUpdate(orderId, orderStatusUpdate('Cancelled'));

      // Restore stock and reverse sale counters when payment initialization fails
      await CheckoutService.restoreStockOnPaymentFailure(orderId);

      return {
        message: paymentInit.message,
        data: null,
        code: paymentInit.code,
      };
    }

    // Payment initialization successful - publish ORDER_CREATED event
    try {
      await eventPublisher.publishOrderCreated({
        orderId,
      });
    } catch (eventError) {
      console.error('[CheckoutService] Failed to publish ORDER_CREATED event:', eventError);
      // Don't fail checkout if event publishing fails
    }

    // For GIG orders: attempt preshipment creation (non-blocking)
    if (deliveryType === 'gig' && shippingAddress) {
      try {
        const products = await Product.find({
          _id: { $in: items.map((i) => i.product) },
        })
          .select('name weight height width length isVolumetric description_images')
          .lean();

        const productMap = new Map(products.map((p) => [p._id.toString(), p]));

        const gigItems = items.map((item) => {
          const prod = productMap.get(item.product.toString());
          return {
            name: prod?.name || 'Product',
            quantity: item.qty,
            weight: prod?.weight ?? 1,
            height: prod?.height ?? 10,
            width: prod?.width ?? 10,
            length: prod?.length ?? 10,
            isVolumetric: prod?.isVolumetric ?? false,
            value: item.unitPrice || 0,
            imageUrl: prod?.description_images?.find((img: { cover_image?: boolean }) => img.cover_image)?.url || '',
          };
        });

        const gigShipment = await GIGService.createShipmentForOrder({
          items: gigItems,
          receiverAddress: shippingAddress.address1 || '',
          receiverState: shippingAddress.state || '',
          receiverCity: shippingAddress.city || undefined,
          receiverLatitude: (shippingAddress as Record<string, unknown>).latitude as number | undefined,
          receiverLongitude: (shippingAddress as Record<string, unknown>).longitude as number | undefined,
          receiverName: `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim(),
          receiverPhoneNumber: shippingAddress.phoneNumber || '',
          receiverEmail: userDoc.email,
        });

        if (gigShipment.data?.waybillNumber) {
          await Order.findByIdAndUpdate(orderId, { gigWaybill: gigShipment.data.waybillNumber });
          console.log(
            `[CheckoutService] GIG preshipment created: ${gigShipment.data.waybillNumber} for order ${orderId}`
          );
        } else {
          console.warn(`[CheckoutService] GIG preshipment failed for order ${orderId}: ${gigShipment.message}`);
        }
      } catch (gigError) {
        // Don't fail checkout if GIG preshipment fails - admin can retry manually
        console.error('[CheckoutService] GIG preshipment creation failed (non-blocking):', gigError);
      }
    }

    const paymentData = paymentInit.data;
    const transaction = paymentData?.transaction as ITransaction | undefined;
    const paymentPayload = paymentData
      ? {
          access_code: paymentData.access_code,
          paymentUrl: paymentData.paymentUrl,
          reference: paymentData.reference,
          transactionId: transaction?._id?.toString() ?? '',
        }
      : null;

    return {
      message: 'Secure checkout completed successfully',
      data: {
        orderId,
        payment: paymentPayload,
        summary: {
          total: finalTotal,
          subtotal: finalSubtotal,
          couponDiscount: finalCouponDiscount,
          shippingCost,
          itemCount: correctedCart.items.length,
          deliveryType,
        },
      },
      code: 200,
    };
  }

  /**
   * Restore stock and reverse sale counters when payment initialization fails
   * This is called immediately when payment gateway initialization fails,
   * before the order timeout mechanism kicks in
   */
  private static async restoreStockOnPaymentFailure(orderId: string): Promise<void> {
    try {
      // 1. Get the order with all product details
      const order = await Order.findById(orderId);
      if (!order || !order.products) {
        console.error(`[CheckoutService] Order ${orderId} not found for stock restoration`);
        return;
      }

      // 2. Extract items for bulk stock update
      const items = order.products
        .filter((item) => item.product && item.qty)
        .map((item) => ({
          productId: item.product!.toString(),
          quantity: item.qty!,
        }));

      if (items.length === 0) {
        console.warn(`[CheckoutService] No items to restore for order ${orderId}`);
        return;
      }

      // 3. Restore stock using bulk write
      const bulkUpdates = items.map((item) => ({
        updateOne: {
          filter: { _id: item.productId },
          update: { $inc: { stock: item.quantity } },
        },
      }));

      await Product.bulkWrite(bulkUpdates);
      console.log(`[CheckoutService] Stock restored for ${items.length} products in order ${orderId}`);

      // 4. Reverse sale counters if order has sale snapshots
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await reverseSaleCountersOnCancel(
          order.products
            .filter((item) => item.product && item.qty)
            .map((item) => ({
              product: item.product!,
              qty: item.qty!,
              sale: item.sale || undefined,
              saleSnapshot: item.saleSnapshot
                ? {
                    type: item.saleSnapshot.type!,
                    variantIndex: item.saleSnapshot.variantIndex!,
                    maxBuys: item.saleSnapshot.maxBuys!,
                    boughtCount: item.saleSnapshot.boughtCount!,
                    attributeName: item.saleSnapshot.attributeName || undefined,
                    attributeValue: item.saleSnapshot.attributeValue || undefined,
                  }
                : undefined,
            })),
          session
        );
        await session.commitTransaction();
        console.log(`[CheckoutService] Sale counters reversed for order ${orderId}`);
      } catch (err) {
        await session.abortTransaction();
        console.error(`[CheckoutService] Failed to reverse sale counters for order ${orderId}:`, err);
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error(`[CheckoutService] Failed to restore stock for order ${orderId}:`, error);
      // Don't throw - we already have a payment initialization error to report
    }
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
