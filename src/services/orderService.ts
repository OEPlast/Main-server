import mongoose from 'mongoose';
import Order, { OrderType } from '../models/Order';
import { TransactionStatus } from '../models/Transaction';
import Product from '@/models/Product';
import User from '@/models/User';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import AnalyticsService from './MainAnalyticsService';
import { findActiveSaleForProduct, checkSaleAvailability } from '@/helpers/salesUtils';
import { SaleOrderProduct, updateSaleCountersOnOrder } from '@/helpers/saleOrderUtils';
import type { SalesType } from '@/models/Sales';
import eventPublisher from '@/events/eventPublisher';
import {
  ProductPricingShape,
  VariantOption,
  resolveBestVariant as resolveVariant,
  applyPricingTier,
} from '@/helpers/pricingUtils';
import Coupon, { CouponType as CouponSchemaType } from '@/models/Coupon';
import CouponRedemption from '@/models/CouponRedemption';
import LogisticsService from '@/services/LogisticsService';
import ShipmentService from '@/services/ShipmentService';

function calculateUnitPrice({
  product,
  variant,
  qty,
  saleContext,
}: {
  product: ProductPricingShape;
  variant?: VariantOption;
  qty: number;
  saleContext?: { discount?: number };
}): { unitPrice: number; base: number; discountAppliedPct: number } {
  const variantPrice = typeof variant?.price === 'number' ? variant.price : undefined;
  let unit = typeof variantPrice === 'number' ? variantPrice : product.price;
  const base = unit;

  // Variant then product tiers
  unit = applyPricingTier(unit, qty, variant?.pricingTiers);
  unit = applyPricingTier(unit, qty, product.pricingTiers);

  // No static discounts - all discounts come from Sales only

  // Sale discount overrides static precedence (applied on resolved base price, not tiered?)
  const salePct = typeof saleContext?.discount === 'number' ? saleContext.discount : 0;
  if (salePct > 0) {
    const baseForSale = typeof variantPrice === 'number' ? variantPrice : product.price;
    unit = Math.max(0, baseForSale - (baseForSale * salePct) / 100);
  }

  // Round unit price to 2 decimal places
  unit = Math.round(unit * 100) / 100;

  return { unitPrice: unit, base, discountAppliedPct: salePct };
}

type CouponDoc = CouponSchemaType & { _id: mongoose.Types.ObjectId };

type PricedItem = {
  product: mongoose.Types.ObjectId | string;
  qty: number;
  price: number;
};

async function validateCouponCodes({
  couponCodes,
  items,
  itemsSubtotal,
  userId,
  session,
}: {
  couponCodes: string[];
  items: PricedItem[];
  itemsSubtotal: number;
  userId: mongoose.Types.ObjectId;
  session: mongoose.ClientSession;
}): Promise<{
  validCoupons: Array<{ code: string; couponDoc: CouponDoc; discount: number }>;
  invalidCoupons: Array<{ code: string; reason: string }>;
  totalDiscount: number;
}> {
  const validCoupons: Array<{ code: string; couponDoc: CouponDoc; discount: number }> = [];
  const invalidCoupons: Array<{ code: string; reason: string }> = [];
  let totalDiscount = 0;

  const now = new Date();
  const userIdStr = userId.toString();

  // Process each coupon code
  for (const code of couponCodes) {
    try {
      // Find coupon by code
      const couponDoc = (await Coupon.findOne({
        coupon: code.toUpperCase(),
        deleted: { $ne: true },
      }).session(session)) as CouponDoc | null;

      if (!couponDoc) {
        invalidCoupons.push({ code, reason: 'Coupon not found' });
        continue;
      }

      // Check if coupon is active
      if (!couponDoc.active) {
        invalidCoupons.push({ code, reason: 'Coupon is inactive' });
        continue;
      }

      // Check date validity
      if (now < couponDoc.startDate || now > couponDoc.endDate) {
        invalidCoupons.push({ code, reason: 'Coupon has expired or not yet active' });
        continue;
      }

      // Check coupon type constraints
      if (couponDoc.couponType === 'one-off-user') {
        const alreadyUsed = await CouponRedemption.countDocuments({
          coupon: couponDoc._id,
          user: userId,
        }).session(session);
        if (alreadyUsed > 0) {
          invalidCoupons.push({ code, reason: 'Coupon already used by this user' });
          continue;
        }
      }

      if (couponDoc.couponType === 'one-off-for-one-person') {
        if (!couponDoc.allowedUser || couponDoc.allowedUser.toString() !== userIdStr) {
          invalidCoupons.push({ code, reason: 'Coupon not allowed for this user' });
          continue;
        }
        const totalRedemptions = await CouponRedemption.countDocuments({
          coupon: couponDoc._id,
        }).session(session);
        if (totalRedemptions >= 1) {
          invalidCoupons.push({ code, reason: 'Coupon already used' });
          continue;
        }
      }

      if (typeof couponDoc.maxUsagePerUser === 'number' && couponDoc.maxUsagePerUser >= 0) {
        const userUsageCount = await CouponRedemption.countDocuments({
          coupon: couponDoc._id,
          user: userId,
        }).session(session);
        if (userUsageCount >= couponDoc.maxUsagePerUser) {
          invalidCoupons.push({ code, reason: 'User usage limit reached' });
          continue;
        }
      }

      // Check minimum order value
      if (typeof couponDoc.minOrderValue === 'number' && itemsSubtotal < couponDoc.minOrderValue) {
        invalidCoupons.push({
          code,
          reason: `Minimum order value of ₦${couponDoc.minOrderValue.toLocaleString()} required`,
        });
        continue;
      }

      // Calculate discount for this coupon
      const { discount } = computeCouponDiscount({
        coupon: couponDoc,
        items,
        itemsSubtotal: Math.max(0, itemsSubtotal - totalDiscount), // Apply on remaining amount
      });

      if (discount > 0) {
        const roundedDiscount = Math.round(discount * 100) / 100;
        validCoupons.push({ code, couponDoc, discount: roundedDiscount });
        totalDiscount += roundedDiscount;
      } else {
        invalidCoupons.push({ code, reason: 'No discount applicable' });
      }
    } catch (error) {
      console.error(`Error validating coupon ${code}:`, error);
      invalidCoupons.push({ code, reason: 'Error validating coupon' });
    }
  }

  return { validCoupons, invalidCoupons, totalDiscount: Math.round(totalDiscount * 100) / 100 };
}

function computeCouponDiscount({
  coupon,
  items,
  itemsSubtotal,
}: {
  coupon: CouponDoc;
  items: PricedItem[];
  itemsSubtotal: number;
}): { discount: number } {
  const type = (coupon.discountType || 'percentage') as 'percentage' | 'fixed';
  const appliesTo = coupon.appliesTo || { scope: 'order' };

  if (type === 'fixed') {
    // Fixed amount on eligible scope
    if (appliesTo.scope === 'order') {
      return { discount: Math.round(Math.min(coupon.discount || 0, itemsSubtotal) * 100) / 100 };
    }
    let eligibleSum = 0;
    if (appliesTo.scope === 'product' && Array.isArray(appliesTo.productIds)) {
      const set = new Set(appliesTo.productIds.map((id) => id.toString()));
      for (const it of items) if (set.has(it.product.toString())) eligibleSum += it.price * it.qty;
    }
    if (appliesTo.scope === 'category' && Array.isArray(appliesTo.categoryIds)) {
      // Requires item categories; fallback to whole order for now
      eligibleSum = itemsSubtotal;
    }
    return { discount: Math.round(Math.min(coupon.discount || 0, eligibleSum) * 100) / 100 };
  } else {
    // percentage
    let base = itemsSubtotal;
    if (appliesTo.scope === 'product' && Array.isArray(appliesTo.productIds)) {
      base = 0;
      const set = new Set(appliesTo.productIds.map((id) => id.toString()));
      for (const it of items) if (set.has(it.product.toString())) base += it.price * it.qty;
    }
    if (appliesTo.scope === 'category' && Array.isArray(appliesTo.categoryIds)) {
      base = itemsSubtotal; // fallback
    }
    const pct = (coupon.discount || 0) / 100;
    return { discount: Math.round(Math.max(0, Math.min(itemsSubtotal, base * pct)) * 100) / 100 };
  }
}

/**
 * Fetches paginated orders for user with optional filters including transaction status.
 * @param page - Current page number.
 * @param limit - Number of orders per page.
 * @param filters - Filters for searching orders.
 */
const getOrderHistory = async (
  page: number,
  limit: number,
  filters: {
    userId: string;
    status?: OrderType['status'];
    transactionStatus?: TransactionStatus | 'all';
  }
): CustomResponseTypeWithMeta<{
  orders: OrderType[];
  totalOrders: number;
  meta: { page: number; limit: number; total: number };
}> => {
  try {
    const pipeline: mongoose.PipelineStage[] = [];

    // Base match stage for user
    const matchStage: Record<string, unknown> = { user: filters.userId };

    // Add order filters
    if (filters.status) {
      matchStage.status = filters.status;
    }

    pipeline.push({ $match: matchStage });

    // Handle transaction status filtering
    if (filters.transactionStatus && filters.transactionStatus !== 'all') {
      // Filter by specific transaction status
      pipeline.push({
        $lookup: {
          from: 'transactions',
          localField: 'transactionId',
          foreignField: '_id',
          as: 'transaction',
        },
      });
      pipeline.push({
        $match: {
          'transaction.status': filters.transactionStatus,
        },
      });
    } else if (!filters.transactionStatus || filters.transactionStatus === 'all') {
      // Default behavior: only show orders with completed transactions (paid orders)
      pipeline.push({
        $lookup: {
          from: 'transactions',
          localField: 'transactionId',
          foreignField: '_id',
          as: 'transaction',
        },
      });
      pipeline.push({
        $match: {
          'transaction.status': 'completed',
        },
      });
    }

    // Sort by creation date
    pipeline.push({ $sort: { createdAt: -1 } });

    // Count total documents
    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Order.aggregate(countPipeline);
    const totalOrders = totalResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });

    // Remove transaction field from final result (keeping it lean)
    pipeline.push({
      $project: {
        transaction: 0,
      },
    });

    const orders = await Order.aggregate(pipeline);

    return {
      message: 'Orders retrieved successfully',
      data: { orders, totalOrders, meta: { page, limit, total: totalOrders } },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching paginated orders:', error);
    return {
      message: 'Failed to fetch orders',
      data: null,
      code: 500,
    };
  }
};

/**
 * Places a new order with stock validation and coupon handling.
 * @param orderData - The data for the new order.
 */

// Accept user as string (will be cast by Mongoose) or ObjectId
// Make array fields optional for input ergonomics
type OrderDataInput = Omit<OrderType, 'createdAt' | 'updatedAt' | 'user' | 'flashSaleApplied'> & {
  user: string | mongoose.Types.ObjectId;
  flashSaleApplied?: OrderType['flashSaleApplied'];
  couponCodes?: string[]; // Add support for coupon codes array
};

// Enhanced order response type that includes additional order creation details
type PlaceOrderResponse = {
  order: OrderType;
  couponResults: Array<{ code: string; applied: boolean; reason?: string; discount?: number }>;
  appliedCoupons: number;
  totalCouponDiscount: number;
};

const placeOrderWithStockValidation = async (
  orderData: OrderDataInput
): Promise<CustomResponseType<PlaceOrderResponse>> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { products } = orderData;

    // Fetch all products in parallel
    const productIds = products.map((item) => item.product);
    const productDocs = await Product.find({ _id: { $in: productIds } }).session(session);

    if (productDocs.length !== products.length) {
      throw new Error('One or more products were not found.');
    }

    // Validate sales for each product and prepare sale updates
    for (const item of products) {
      if (item.sale) {
        // Re-fetch sale and check availability
        if (!item.product) {
          throw new Error('Product reference is missing for a sale item.');
        }
        const sale = (await findActiveSaleForProduct(item.product.toString())) as unknown as SalesType | null;
        if (!sale) {
          throw new Error('Sale no longer available for a product.');
        }
        const { available } = checkSaleAvailability(sale, item.attributes);
        if (!available) {
          throw new Error('Sale/variant is no longer available for a product.');
        }
      }
    }

    // Recompute prices and totals to prevent tampering
    let itemsSubtotal = 0;
    let itemsBaseSubtotal = 0;
    for (const item of products as Array<{
      product: mongoose.Types.ObjectId | string;
      qty: number;
      price?: number;
      attributes?: { name: string; value: string }[];
      sale?: mongoose.Types.ObjectId | string;
    }>) {
      const productDoc = productDocs.find((p) => p._id.toString() === item.product!.toString());
      if (!productDoc) throw new Error('Product not found for pricing.');
      const qty = Number(item.qty || 0);
      if (qty < 1) throw new Error('Invalid quantity for product.');

      // Resolve sale discount, if any
      let saleDiscount: number | undefined;
      if (item.sale) {
        const sale = (await findActiveSaleForProduct(item.product!.toString())) as unknown as SalesType | null;
        if (sale) {
          const { available, discount, amountOff } = checkSaleAvailability(sale, item.attributes);
          if (available) {
            // Use amountOff if available, otherwise use percentage discount
            if (amountOff && amountOff > 0) {
              // For amountOff, we need to convert it to a percentage for the existing pricing logic
              const basePrice = productDoc.price;
              saleDiscount = Math.min((amountOff / basePrice) * 100, 100);
            } else {
              saleDiscount = typeof discount === 'number' ? discount : 0;
            }
          }
        }
      }

      const variant = resolveVariant(
        productDoc as unknown as ProductPricingShape,
        (item.attributes || []) as {
          name: string;
          value: string;
        }[]
      );
      const pricing = calculateUnitPrice({
        product: productDoc as unknown as ProductPricingShape,
        variant,
        qty,
        saleContext: { discount: saleDiscount },
      });
      // Update item price to computed unit
      item.price = Math.round(pricing.unitPrice * 100) / 100;
      itemsSubtotal += pricing.unitPrice * qty;
      itemsBaseSubtotal += pricing.base * qty;
    }

    // Round subtotals to 2 decimal places
    itemsSubtotal = Math.round(itemsSubtotal * 100) / 100;
    itemsBaseSubtotal = Math.round(itemsBaseSubtotal * 100) / 100;

    // Handle coupon codes validation and application
    let totalCouponDiscount = 0;
    let appliedCouponDocs: CouponDoc[] = [];
    let couponResults: Array<{ code: string; applied: boolean; reason?: string; discount?: number }> = [];

    if (orderData.couponCodes && orderData.couponCodes.length > 0) {
      const couponValidation = await validateCouponCodes({
        couponCodes: orderData.couponCodes,
        items: products as PricedItem[],
        itemsSubtotal,
        userId: orderData.user as mongoose.Types.ObjectId,
        session,
      });

      totalCouponDiscount = Math.round(couponValidation.totalDiscount * 100) / 100;
      appliedCouponDocs = couponValidation.validCoupons.map((v) => v.couponDoc);

      // Prepare results for response
      couponResults = [
        ...couponValidation.validCoupons.map((v) => ({
          code: v.code,
          applied: true,
          discount: Math.round(v.discount * 100) / 100,
        })),
        ...couponValidation.invalidCoupons.map((v) => ({
          code: v.code,
          applied: false,
          reason: v.reason,
        })),
      ];
    }

    // Legacy support for single coupon (if still used elsewhere)
    let couponDoc: CouponDoc | null = null;
    let couponDiscount = 0;
    let couponSnapshot: OrderType['couponSnapshot'] | undefined;

    if (orderData.couponApplied) {
      const now = new Date();
      const found = await Coupon.findOne({
        coupon: orderData.couponApplied,
        deleted: { $ne: true },
        active: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      }).session(session);

      if (!found) throw new Error('Invalid or expired coupon.');
      couponDoc = found as unknown as CouponDoc;

      // Enforce min order value
      if (typeof couponDoc.minOrderValue === 'number' && itemsSubtotal < couponDoc.minOrderValue) {
        throw new Error('Order total does not meet coupon minimum.');
      }

      // Compute discount
      const { discount } = computeCouponDiscount({ coupon: couponDoc, items: products as PricedItem[], itemsSubtotal });
      couponDiscount = Math.round(Math.min(discount, itemsSubtotal) * 100) / 100;
      if (couponDiscount > 0) {
        couponSnapshot = {
          discount: couponDoc.discount,
          discountType: couponDoc.discountType || 'percentage',
          appliesTo: couponDoc.appliesTo || { scope: 'order' },
        } as OrderType['couponSnapshot'];
      }
    }

    // Use multiple coupon discount if available, otherwise legacy single coupon
    const finalCouponDiscount =
      Math.round((totalCouponDiscount > 0 ? totalCouponDiscount : couponDiscount) * 100) / 100;

    // Check stock and prepare updates
    const bulkUpdates = products.map((item) => {
      const product = productDocs.find((p) => p._id.toString() === item.product!.toString());
      if (!product || product.stock < item.qty!) {
        throw new Error(`Product "${product?.name}" is out of stock or insufficient quantity.`);
      }
      return {
        updateOne: {
          filter: { _id: item.product, stock: { $gte: item.qty } },
          update: { $inc: { stock: -item.qty! } },
        },
      };
    });

    // Perform bulk stock update
    await Product.bulkWrite(bulkUpdates, { session });

    // Emit low stock events for affected products if needed
    const updatedProducts = await Product.find({ _id: { $in: productIds } })
      .session(session)
      .select('name stock lowStockThreshold');
    for (const p of updatedProducts) {
      if (p.stock <= p.lowStockThreshold) {
        await eventPublisher.publishInventoryLow(p._id.toString(), p.stock, p.lowStockThreshold, p.name);
      }
    }

    // Atomically update sale counters (limit, boughtCount, etc.)
    await updateSaleCountersOnOrder(products as SaleOrderProduct[], session);

    // Calculate shipping cost using LogisticsService
    let calculatedShipping = 0;
    try {
      if (orderData.shippingAddress) {
        // Prepare cart items for logistics calculation
        const cartItems = products.map((item) => ({
          productId: item.product!.toString(),
          quantity: item.qty!,
        }));

        // Prepare destination from shipping address
        const destination = {
          countryName: orderData.shippingAddress.country || 'Nigeria', // Default to Nigeria if not provided
          stateCode: orderData.shippingAddress.state || 'LA', // Default to Lagos if not provided
          lgaName: 'Default', // LGA not provided in shipping address, use default
        };

        // Calculate progressive shipping cost
        calculatedShipping = await LogisticsService.calculateProgressiveShipping(cartItems, destination);

        console.log(`[OrderService] Calculated shipping: ₦${calculatedShipping} for destination:`, destination);
      } else {
        console.warn('[OrderService] No shipping address provided, using fallback shipping cost');
        calculatedShipping = Number(orderData.shippingPrice || 0);
      }
    } catch (shippingError) {
      console.error('[OrderService] Shipping calculation failed, using provided/fallback value:', shippingError);
      calculatedShipping = Number(orderData.shippingPrice || 0);
    }

    // Compute final totals with calculated shipping
    const shipping = Math.round(calculatedShipping * 100) / 100;
    const tax = Math.round(Number(orderData.taxPrice || 0) * 100) / 100;
    const subtotalAfterCoupon = Math.round(Math.max(0, itemsSubtotal - finalCouponDiscount) * 100) / 100;
    const finalTotal = Math.round((subtotalAfterCoupon + shipping + tax) * 100) / 100;

    // Create the order with recomputed totals
    const order = new Order({
      ...orderData,
      total: finalTotal,
      totalBeforeDiscount: Math.round(itemsBaseSubtotal * 100) / 100,
      shippingPrice: shipping, // Use calculated shipping price
      products,
      // Handle multiple coupons if applied
      ...(appliedCouponDocs.length > 0
        ? {
            coupon: appliedCouponDocs[0]._id, // Legacy single coupon field
            couponCode: appliedCouponDocs[0].coupon,
            couponDiscount: finalCouponDiscount,
            couponApplied: appliedCouponDocs.map((c) => c.coupon).join(', '),
            couponSnapshot: {
              discount: appliedCouponDocs[0].discount,
              discountType: appliedCouponDocs[0].discountType || 'percentage',
              appliesTo: appliedCouponDocs[0].appliesTo || { scope: 'order' },
            } as OrderType['couponSnapshot'],
          }
        : couponDoc
          ? {
              coupon: couponDoc._id,
              couponCode: couponDoc.coupon,
              couponDiscount: finalCouponDiscount,
              couponSnapshot,
              couponApplied: couponDoc.coupon,
            }
          : {}),
    });
    await order.save({ session });

    // Create shipment for shipping orders
    if (orderData.deliveryType === 'shipping') {
      try {
        const shipmentResult = await ShipmentService.createShipmentForOrder(order._id, session);
        if (shipmentResult) {
          console.log(`[OrderService] Created shipment ${shipmentResult.trackingNumber} for order ${order._id}`);
        }
      } catch (shipmentError) {
        console.error('[OrderService] Failed to create shipment, but order was placed successfully:', shipmentError);
        // Don't fail the order if shipment creation fails - admin can create manually later
      }
    }

    // Record coupon redemptions for all applied coupons
    if (appliedCouponDocs.length > 0) {
      const redemptions = appliedCouponDocs.map((coupon, index) => ({
        coupon: coupon._id,
        user: orderData.user as mongoose.Types.ObjectId,
        order: order._id as mongoose.Types.ObjectId,
        amountDiscounted: couponResults.find((r) => r.applied && r.discount && appliedCouponDocs[index])?.discount || 0,
        couponType: coupon.couponType,
      }));

      await CouponRedemption.create(redemptions, { session });

      // Update coupon usage counters
      for (const coupon of appliedCouponDocs) {
        const update: mongoose.UpdateQuery<CouponSchemaType> = {
          $inc: { timesUsed: 1 },
          ...(coupon.couponType === 'one-off-user'
            ? { $addToSet: { usedBy: orderData.user as mongoose.Types.ObjectId } }
            : {}),
        } as unknown as mongoose.UpdateQuery<CouponSchemaType>;

        await Coupon.updateOne({ _id: coupon._id }, update, { session });

        // Emit coupon redeemed event
        await eventPublisher.publishCouponRedeemed({
          couponId: coupon._id.toString(),
          userId: orderData.user.toString(),
          orderId: order._id.toString(),
          amountDiscounted:
            couponResults.find((r) => r.applied && appliedCouponDocs.find((c) => c.coupon === r.code))?.discount || 0,
          code: coupon.coupon,
        });
      }
    } else if (couponDoc && couponDiscount > 0) {
      // Legacy single coupon handling
      await CouponRedemption.create(
        [
          {
            coupon: couponDoc._id,
            user: orderData.user as mongoose.Types.ObjectId,
            order: order._id as mongoose.Types.ObjectId,
            amountDiscounted: couponDiscount,
            couponType: couponDoc.couponType,
          },
        ],
        { session }
      );

      // increment timesUsed and add usedBy for one-off-user
      const update: mongoose.UpdateQuery<CouponSchemaType> = {
        $inc: { timesUsed: 1 },
        ...(couponDoc.couponType === 'one-off-user'
          ? { $addToSet: { usedBy: orderData.user as mongoose.Types.ObjectId } }
          : {}),
      } as unknown as mongoose.UpdateQuery<CouponSchemaType>;

      await Coupon.updateOne({ _id: couponDoc._id }, update, { session });

      // Emit coupon redeemed event
      await eventPublisher.publishCouponRedeemed({
        couponId: couponDoc._id.toString(),
        userId: orderData.user.toString(),
        orderId: order._id.toString(),
        amountDiscounted: couponDiscount,
        code: couponDoc.coupon,
      });
    }

    await session.commitTransaction();
    session.endSession();

    // Fetch user details for order created event
    try {
      const userDoc = await User.findById(orderData.user).select('firstName lastName email');
      if (userDoc) {
        const customerInfo = {
          email: userDoc.email,
          name: `${userDoc.firstName} ${userDoc.lastName}`.trim(),
          phone: orderData.shippingAddress?.phoneNumber || undefined,
        };

        // Publish ORDER_CREATED event for email notifications and other processing
        await eventPublisher.publishOrderCreated({
          orderId: order._id.toString(),
          userId: orderData.user.toString(),
          orderNumber: order._id.toString(), // Using order ID as order number since no orderNumber field exists
          totalAmount: order.total,
          items: order.products
            .filter((item) => item.product && typeof item.qty === 'number' && typeof item.price === 'number')
            .map((item) => ({
              productId: item.product!.toString(),
              quantity: item.qty!,
              price: item.price!,
            })),
          customerInfo,
        });
      }
    } catch (eventError) {
      console.error('Failed to publish ORDER_CREATED event:', eventError);
      // Don't fail the order creation if event publishing fails
    }

    // Track order analytics after successful transaction
    AnalyticsService.trackOrderPlaced(order._id.toString(), order.total).catch((err) =>
      console.error('Failed to track order analytics:', err)
    );

    return {
      message: 'Order placed successfully',
      data: {
        order,
        couponResults, // Include coupon application results in response
        appliedCoupons: appliedCouponDocs.length,
        totalCouponDiscount: finalCouponDiscount,
      },
      code: 201,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error placing order with stock validation:', error);
    if (error instanceof Error) {
      return {
        message: error.message || 'Failed to place order',
        data: null,
        code: 400,
      };
    } else {
      return {
        message: 'Internal server error',
        data: null,
        code: 500,
      };
    }
  }
};

const updateOrderDetails = async (
  orderId: string,
  userId: string,
  address?: OrderType['shippingAddress']
): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return { message: 'Order not found', data: null, code: 404 };
    }

    if (order.status !== 'Pending') {
      return { message: 'Cannot update order data after it has been processed', data: null, code: 400 };
    }

    if (address) order.shippingAddress = address;

    await order.save();

    return { message: 'Order updated successfully', data: null, code: 200 };
  } catch (error) {
    return { message: 'Failed to update order', data: null, code: 500 };
  }
};

const cancelOrder = async (orderId: string, userId: string): Promise<CustomResponseType> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({ _id: orderId, user: userId }).session(session);

    if (!order) {
      throw new Error('Order not found.');
    }

    // Check if order can be cancelled based on its current status
    if (order.status === 'Completed' || order.status === 'Cancelled') {
      throw new Error('Order cannot be canceled. It has already been completed or cancelled.');
    }

    // For shipping orders, check shipment status
    if (order.deliveryType === 'shipping' && order.shipmentId) {
      const deliveryStatus = await ShipmentService.getDeliveryStatus(orderId);
      if (deliveryStatus === 'Shipped' || deliveryStatus === 'Dispatched' || deliveryStatus === 'Delivered') {
        throw new Error('Order cannot be canceled. It may have already been shipped.');
      }
    }

    // Restore stock
    const bulkUpdates = order.products.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: item.qty } },
      },
    }));

    await Product.bulkWrite(bulkUpdates, { session });

    // Update order status
    order.status = 'Cancelled';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Track order cancellation for analytics
    // This runs independently and won't affect the response time
    AnalyticsService.trackOrderReturned(orderId).catch((err) =>
      console.error('Failed to track order return analytics:', err)
    );

    return { message: 'Order canceled successfully', data: null, code: 200 };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error instanceof Error) {
      return { message: error.message || 'Failed to cancel order', data: null, code: 500 };
    } else {
      return {
        message: 'Internal server error',
        data: null,
        code: 500,
      };
    }
  }
};

const getOneOrder = async ({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}): Promise<CustomResponseType<OrderType>> => {
  try {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return { message: 'Order not found', data: null, code: 404 };
    }

    return { message: 'Order retrieved successfully', data: order, code: 200 };
  } catch (error) {
    console.error('Error fetching order:', error);
    return { message: 'Failed to fetch order', data: null, code: 500 };
  }
};

const initiateReturn = async (orderId: string, userId: string): Promise<CustomResponseType<null>> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({ _id: orderId, user: userId }).session(session);

    if (!order) {
      throw new Error('Order not found.');
    }

    // Check delivery status via shipment for shipping orders
    let canReturn = false;
    if (order.deliveryType === 'shipping' && order.shipmentId) {
      const deliveryStatus = await ShipmentService.getDeliveryStatus(orderId);
      canReturn = deliveryStatus === 'Delivered';
    } else if (order.deliveryType === 'pickup') {
      // For pickup orders, check if they've been completed/delivered
      canReturn = order.status === 'Completed';
    }

    if (!canReturn) {
      throw new Error('Only delivered orders can be returned.');
    }

    // For shipping orders with shipments, update shipment status to 'Returned'
    if (order.deliveryType === 'shipping' && order.shipmentId) {
      // We'll let the admin shipment service handle updating the shipment status
      // For now, just mark the order as having a return initiated
      console.log(`[OrderService] Return initiated for order ${orderId} - shipment ${order.shipmentId} should be updated`);
    }

    await session.commitTransaction();
    session.endSession();

    // Track order return for analytics
    AnalyticsService.trackOrderReturned(orderId).catch((err) =>
      console.error('Failed to track order return analytics:', err)
    );

    return { message: 'Order return initiated successfully', data: null, code: 200 };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error instanceof Error) {
      return { message: error.message || 'Failed to initiate return', data: null, code: 500 };
    } else {
      return {
        message: 'Internal server error',
        data: null,
        code: 500,
      };
    }
  }
};

const getAllReturns = async ({
  userId,
  page = 1,
  limit = 10,
}: {
  userId?: string;
  page?: number;
  limit?: number;
}): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>> => {
  try {
    // For now, we'll find orders where returns were initiated
    // In a full implementation, we might track returns in a separate collection
    // or use shipment status to determine returns
    const pipeline = [
      { 
        $match: { 
          user: userId,
          // We could add a 'returnInitiated' flag to orders, or check shipment status
          // For now, let's return orders that are completed (as potential returns)
          status: 'Completed' 
        } 
      },
      {
        $lookup: {
          from: 'shipments',
          localField: 'shipmentId',
          foreignField: '_id',
          as: 'shipment'
        }
      },
      {
        $match: {
          $or: [
            { 'shipment.status': 'Returned' }, // Shipping orders with returned status
            { deliveryType: 'pickup', status: 'Completed' } // Pickup orders that are completed
          ]
        }
      },
      {
        $facet: {
          orders: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          totalOrders: [{ $count: 'count' }],
        },
      },
    ];

    const result = await Order.aggregate(pipeline);
    const orders = result[0]?.orders || [];
    const totalOrders = result[0]?.totalOrders[0]?.count || 0;

    return {
      message: 'Returned orders retrieved successfully',
      data: { orders, totalOrders },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching returned orders:', error);
    return {
      message: 'Failed to fetch returned orders',
      data: null,
      code: 500,
    };
  }
};

/**
 * Get order with new returns populated
 */
const getOrderWithReturns = async (orderId: string): Promise<CustomResponseType<any>> => {
  try {
    const order = await Order.findById(orderId)
      .populate('userId', 'firstName lastName email')
      .populate('items.product', 'name images')
      .lean();

    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }

    // Populate returns from the new Return model
    const Return = (await import('../models/Return')).default;
    const returns = await Return.find({ order: orderId })
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .lean();

    return {
      message: 'Order with returns fetched successfully',
      data: {
        ...order,
        returns,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching order with returns:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch order with returns',
      data: null,
      code: 500,
    };
  }
};

const OrderService = {
  getOrderHistory,
  placeOrderWithStockValidation,
  cancelOrder,
  updateOrderDetails,
  getOneOrder,
  initiateReturn,
  getAllReturns,
  getOrderWithReturns,
};

export default OrderService;
