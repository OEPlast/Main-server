import { Types } from 'mongoose';
import Cart from '@/models/Cart';
import User from '@/models/User';
import Product from '@/models/Product';
import { ITransaction } from '@/models/Transaction';
import LogisticsService from '@/services/LogisticsService';
import GIGService from '@/services/GIGService';
import OrderService from '@/services/orderService';
import PaymentService from '@/services/TransactionService';
import { FrontendCartData, validateAndCorrectCart, CorrectedCart } from '@/services/CartValidationService';
import { applyFreeDelivery, priceCart } from '@/services/pricing';
import type { OrderType } from '@/models/Order';
import { CustomResponseType } from '@/types';
import eventPublisher from '@/events/eventPublisher';
import { cancelOrder } from '@/services/orders/orderLifecycle';
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
      billingAddress,
      billingSameAsShipping = true,
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
    const { enabledDeliveryMethods, shippingDiscountAmountOff, freeShippingThreshold } = checkoutConfigResult.data;

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

    // A caller that opts out of mirroring has to supply the address it opted out in favour of.
    // Note the inverse is deliberately not enforced: on a pickup order there is no shipping
    // address to mirror, so `billingSameAsShipping` simply resolves to nothing rather than
    // failing — the storefront is what decides whether to insist on one.
    if (billingSameAsShipping === false && !billingAddress) {
      return {
        message: 'Billing address is required when it differs from the shipping address',
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
      // GIG shipping: calculate via GIG API. Declared value = the line total from the shared
      // pricing module, the same value the storefront's quote (GIGController) declared.
      const pricedForQuote = await priceCart(items.map((i) => ({ product: i.product, qty: i.qty, selectedAttributes: i.selectedAttributes })));
      const lineTotalByIndex = new Map(
        pricedForQuote.missingProductIds.length ? [] : pricedForQuote.lines.map((line, index) => [index, line.lineTotal])
      );
      const products = await Product.find({
        _id: { $in: items.map((i) => i.product) },
      })
        .select('name weight height width length isVolumetric description_images')
        .lean();

      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      const gigItems = items.map((item, index) => {
        const prod = productMap.get(item.product.toString());
        return {
          name: prod?.name || 'Product',
          quantity: item.qty,
          weight: prod?.weight ?? 1,
          height: prod?.height ?? 10,
          width: prod?.width ?? 10,
          length: prod?.length ?? 10,
          isVolumetric: prod?.isVolumetric ?? false,
          value: lineTotalByIndex.get(index) ?? (item.unitPrice || 0) * item.qty,
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
      // `total` from the storefront includes the delivery cost it was shown; take that same figure off.
      total: total - (frontendShippingCost ?? shippingCost),
      totalDiscount,
      estimatedShipping: estimatedShipping || { cost: shippingCost, days: 0 },
    };

    const validationResult = await validateAndCorrectCart(frontendCartData, couponCodes, userId);
    if (!validationResult.data) {
      return {
        message: 'Failed to validate cart data',
        data: null,
        code: 500,
      };
    }

    const correctedCart = validationResult.data.correctedCart;

    // Free delivery over the threshold, for every delivery method, on the validated items subtotal.
    if (deliveryType !== 'pickup') {
      shippingCost = applyFreeDelivery(shippingCost, correctedCart.subtotal, freeShippingThreshold).amount;
    }

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
        // Sale fields (sale, saleType, saleVariantIndex, saleDiscount) are set by order creation
        // from its own pricing pass, inside the transaction.
      })),
      // `!== 'pickup'` rather than `=== 'shipping'`: GIG orders were previously saved with no
      // address at all, which left ShipmentService unable to create their shipment and their
      // confirmation emails with an empty address line — even though the address had been
      // required, quoted against and sent to the courier moments earlier.
      shippingAddress: deliveryType !== 'pickup' ? shippingAddress : undefined,
      // Billing intentionally never feeds the shipping quote or the courier payload above —
      // both of those read `shippingAddress` directly and must keep doing so.
      billingAddress: billingSameAsShipping ? shippingAddress : billingAddress,
      billingSameAsShipping,
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
      // Only present for guest checkout (the controller strips it for signed-in shoppers).
      guestContact: payload.guest
        ? {
            email: payload.guest.email,
            firstName: payload.guest.firstName,
            lastName: payload.guest.lastName,
            phoneNumber: payload.guest.phoneNumber,
          }
        : undefined,
    } as unknown as OrderDataInput;

    const userDoc = await User.findById(userId).select('email');
    if (!userDoc?.email) {
      return {
        message: 'User email not found for payment initialization',
        data: null,
        code: 400,
      };
    }

    // `expectedTotal` is what the shopper confirmed; order creation refuses to charge anything else.
    const placed = await OrderService.placeOrderWithStockValidation(orderInput, { expectedTotal: finalTotal });
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
      // Cancels and hands back stock, sale allocation and coupon usage in one step.
      await cancelOrder({
        orderId,
        by: 'system',
        refund: 'await_staff',
        notifyCustomer: false,
        reason: 'Payment could not be started',
      });

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

    // GIG preshipments are booked once the order is paid (orderLifecycle.fulfilPaidOrder), not here:
    // booking at checkout left a courier shipment behind for every abandoned GIG checkout.

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
