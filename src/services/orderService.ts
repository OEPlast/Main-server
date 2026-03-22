import mongoose from 'mongoose';
import Order, { OrderType } from '../models/Order';
import Product from '@/models/Product';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import AnalyticsService from './MainAnalyticsService';
import { findActiveSaleForProduct, checkSaleAvailability } from '@/helpers/salesUtils';
import { SaleOrderProduct, updateSaleCountersOnOrder, reverseSaleCountersOnCancel } from '@/helpers/saleOrderUtils';
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
import GIGService from '@/services/GIGService';
import ShipmentService from '@/services/ShipmentService';
import Return, { ReturnType } from '../models/Return';
import { EnrichedOrder } from './admin/Order';
import type { CouponDoc, PricedItem, OrderDataInput, PlaceOrderResponse } from '@/types/order';
import { validateCouponCodes, computeCouponDiscount } from '@/helpers/couponUtils';

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

/**
 * Fetches paginated orders for user with optional filters.
 * Enhanced to populate first 2 products with full details (name, image, slug, etc.)
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
  }
): CustomResponseTypeWithMeta<
  { orders: OrderType[] },
  { page: number; limit: number; total: number; totalPages: number }
> => {
  try {
    const pipeline: mongoose.PipelineStage[] = [];
    // Base match stage for user

    const matchStage: Record<string, unknown> = { user: new mongoose.Types.ObjectId(filters.userId) };

    // Add order status filter
    if (filters.status && filters.status.toLowerCase() !== 'all') {
      matchStage.status = filters.status;
    }

    pipeline.push({ $match: matchStage });

    // Sort by creation date
    pipeline.push({ $sort: { createdAt: -1 } });

    // Use $facet to count and paginate in a single aggregation
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        orders: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          // ENHANCEMENT: Populate first 2 products with full details
          // Step 1: Lookup product details for the first 2 products
          {
            $lookup: {
              from: 'products',
              let: {
                productIds: { $slice: [{ $map: { input: '$products', as: 'p', in: '$$p.product' } }, 2] },
              },
              pipeline: [
                {
                  $match: {
                    $expr: { $in: ['$_id', '$$productIds'] },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    name: 1,
                    slug: 1,
                    description_images: 1,
                  },
                },
              ],
              as: 'productDetails',
            },
          },
          // Step 2: Add computed fields for order summary
          {
            $addFields: {
              totalProducts: { $size: '$products' },
              totalItems: {
                $reduce: {
                  input: '$products',
                  initialValue: 0,
                  in: { $add: ['$$value', '$$this.qty'] },
                },
              },
            },
          },
          // Step 3: Map first 2 products with enriched details
          {
            $addFields: {
              enrichedProducts: {
                $map: {
                  input: { $slice: ['$products', 2] },
                  as: 'orderProduct',
                  in: {
                    $let: {
                      vars: {
                        productDetail: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: '$productDetails',
                                as: 'pd',
                                cond: { $eq: ['$$pd._id', '$$orderProduct.product'] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: {
                        _id: '$$orderProduct.product',
                        name: { $ifNull: ['$$productDetail.name', 'Product Not Found'] },
                        slug: { $ifNull: ['$$productDetail.slug', 'unknown'] },
                        image: {
                          $let: {
                            vars: {
                              coverImage: {
                                $arrayElemAt: [
                                  {
                                    $map: {
                                      input: {
                                        $filter: {
                                          input: { $ifNull: ['$$productDetail.description_images', []] },
                                          as: 'img',
                                          cond: { $eq: ['$$img.cover_image', true] },
                                        },
                                      },
                                      as: 'coverImg',
                                      in: '$$coverImg.url',
                                    },
                                  },
                                  0,
                                ],
                              },
                              firstImage: {
                                $arrayElemAt: [
                                  {
                                    $map: {
                                      input: { $ifNull: ['$$productDetail.description_images', []] },
                                      as: 'img',
                                      in: '$$img.url',
                                    },
                                  },
                                  0,
                                ],
                              },
                            },
                            in: { $ifNull: ['$$coverImage', '$$firstImage'] },
                          },
                        },
                        quantity: '$$orderProduct.qty',
                        price: '$$orderProduct.price',
                        attributes: { $ifNull: ['$$orderProduct.attributes', []] },
                        sale: '$$orderProduct.sale',
                        saleDiscount: { $ifNull: ['$$orderProduct.saleDiscount', 0] },
                      },
                    },
                  },
                },
              },
            },
          },
          // Step 4: Final projection - clean up intermediate fields
          {
            $project: {
              productDetails: 0,
              products: 0,
            },
          },
          // Step 5: Rename enrichedProducts to products
          {
            $addFields: {
              products: '$enrichedProducts',
            },
          },
          {
            $project: {
              shippingAddress: 0,
              enrichedProducts: 0,
              paymentMethod: 0,
            },
          },
        ],
      },
    });

    const result = await Order.aggregate(pipeline);
    const total: number = result[0]?.metadata[0]?.total || 0;
    const orders = result[0]?.orders || [];
    const totalPages = Math.ceil(total / limit);

    return {
      message: 'Orders retrieved successfully',
      data: { orders: orders as unknown as OrderType[] },
      meta: { page, limit, total, totalPages },
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
        const productDoc = productDocs.find((p) => p._id.toString() === item.product!.toString());
        const productName = productDoc?.name || 'Unknown product';
        const productSku = productDoc?.sku || item.product.toString();

        const sale = (await findActiveSaleForProduct(item.product.toString())) as unknown as SalesType | null;

        if (!sale) {
          throw new Error(`Sale no longer available for product: ${productName} (SKU: ${productSku})`);
        }
        const { available } = checkSaleAvailability(sale, item.attributes);
        if (!available) {
          throw new Error(`Sale/variant is no longer available for product: ${productName} (SKU: ${productSku})`);
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
      if (p.stock === 0) {
        await eventPublisher.publishInventoryOutOfStock(p._id.toString(), p.name, 0);
      } else if (p.stock <= p.lowStockThreshold) {
        await eventPublisher.publishInventoryLow(p._id.toString(), p.stock, p.lowStockThreshold, p.name);
      }
    }

    // Atomically update sale counters (limit, boughtCount, etc.) and get snapshots
    const saleSnapshots = await updateSaleCountersOnOrder(products as SaleOrderProduct[], session);

    // Store sale snapshots in product items for reversal on cancellation
    for (const product of products) {
      const productId = product.product!.toString();
      const snapshot = saleSnapshots.get(productId);
      if (snapshot) {
        product.saleSnapshot = snapshot;
      }
    }
    const checkoutConfig = await GIGService.getPublicCheckoutConfig();
    const freeShippingThreshold = checkoutConfig.data.freeShippingThreshold;
    const qualifiesForFreeShipping =
      Number.isFinite(freeShippingThreshold) &&
      freeShippingThreshold !== null &&
      itemsSubtotal >= freeShippingThreshold;

    // Calculate shipping cost using LogisticsService
    let calculatedShipping = 0;
    try {
      if (orderData.deliveryType === 'pickup') {
        calculatedShipping = 0;
      } else if (orderData.deliveryType === 'gig') {
        calculatedShipping = Number(orderData.shippingPrice || 0);
      } else if (orderData.shippingAddress) {
        // Prepare cart items for logistics calculation
        const cartItems = products.map((item) => ({
          productId: item.product!.toString(),
          quantity: item.qty!,
        }));

        // Prepare destination from shipping address
        const destination = {
          countryName: orderData.shippingAddress.country || 'Nigeria', // Default to Nigeria if not provided
          stateName: orderData.shippingAddress.state || 'Lagos', // Default to Lagos if not provided
          lgaName: orderData.shippingAddress.lga || '', // LGA not provided in shipping address, use default
          city: orderData.shippingAddress.city || '',
        };

        // Calculate progressive shipping cost
        calculatedShipping = await LogisticsService.calculateProgressiveShipping(cartItems, destination);
        calculatedShipping = GIGService.applyDeliveryDiscount(
          calculatedShipping,
          checkoutConfig.data.shippingDiscountAmountOff
        ).finalAmount;

        if (qualifiesForFreeShipping) {
          calculatedShipping = 0;
        }

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
      couponDiscount: finalCouponDiscount,
      // Handle multiple coupons if applied
      ...(appliedCouponDocs.length > 0
        ? {
            coupon: appliedCouponDocs[0]._id,
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
    /*
    // Fetch user details for order created event
    try {
      // Publish ORDER_CREATED event for email notifications and other processing
      await eventPublisher.publishOrderCreated({
        orderId: order._id.toString(),
      });
    } catch (eventError) {
      console.error('Failed to publish ORDER_CREATED event:', eventError);
      // Don't fail the order creation if event publishing fails
    }

    // Track order analytics after successful transaction
    AnalyticsService.trackOrderPlaced(order._id.toString(), order.total).catch((err) =>
      console.error('Failed to track order analytics:', err)
    );
    */

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
  } catch {
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

    // Reverse sale counters if snapshots exist
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
}): Promise<CustomResponseType<EnrichedOrder>> => {
  try {
    const pipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(orderId), user: new mongoose.Types.ObjectId(userId) } },

      // Lookup products with details
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },

      // Lookup transaction details
      {
        $lookup: {
          from: 'transactions',
          localField: 'transactionId',
          foreignField: '_id',
          as: 'transaction',
        },
      },
      { $unwind: { path: '$transaction', preserveNullAndEmptyArrays: true } },

      // Lookup shipment details
      {
        $lookup: {
          from: 'shipments',
          localField: 'shipmentId',
          foreignField: '_id',
          as: 'shipment',
        },
      },
      { $unwind: { path: '$shipment', preserveNullAndEmptyArrays: true } },

      // Lookup coupon details
      {
        $lookup: {
          from: 'coupons',
          localField: 'coupon',
          foreignField: '_id',
          as: 'couponDetails',
        },
      },
      { $unwind: { path: '$couponDetails', preserveNullAndEmptyArrays: true } },

      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },

      // Project final structure
      {
        $project: {
          _id: 1,
          orderNumber: { $toString: '$_id' },

          // Order summary
          total: 1,
          totalBeforeDiscount: 1,
          couponDiscount: 1,
          shippingPrice: 1,
          taxPrice: 1,
          status: 1,
          isPaid: 1,
          deliveryType: 1,
          deliveryStatus: 1,
          createdAt: 1,
          updatedAt: 1,
          paidAt: 1,
          deliveredAt: 1,

          // Coupon info
          coupon: {
            code: '$couponCode',
            discount: '$couponDiscount',
            name: '$couponDetails.name',
          },

          // Contact information
          contact: {
            name: {
              $concat: ['$userDetails.firstName', ' ', '$userDetails.lastName'],
            },
            phone: {
              $cond: {
                if: { $eq: ['$deliveryType', 'pickup'] },
                then: '$userDetails.phone',
                else: '$shippingAddress.phoneNumber',
              },
            },
            email: '$userDetails.email',
          },

          // Shipping address (for shipping and gig delivery types)
          shippingAddress: {
            $cond: {
              if: { $in: ['$deliveryType', ['shipping', 'gig']] },
              then: '$shippingAddress',
              else: null,
            },
          },

          // Billing address (same as shipping for now)
          billingAddress: {
            $cond: {
              if: { $in: ['$deliveryType', ['shipping', 'gig']] },
              then: '$shippingAddress',
              else: null,
            },
          },

          // GIG waybill number
          gigWaybill: 1,

          // Products with enriched details
          products: {
            $map: {
              input: '$products',
              as: 'orderProduct',
              in: {
                $let: {
                  vars: {
                    productDetail: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$productDetails',
                            as: 'pd',
                            cond: { $eq: ['$$pd._id', '$$orderProduct.product'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: {
                    _id: '$$orderProduct.product',
                    name: '$$productDetail.name',
                    slug: '$$productDetail.slug',
                    image: {
                      $ifNull: [
                        {
                          $arrayElemAt: [
                            {
                              $map: {
                                input: {
                                  $filter: {
                                    input: '$$productDetail.description_images',
                                    as: 'img',
                                    cond: { $eq: ['$$img.cover_image', true] },
                                  },
                                },
                                as: 'coverImg',
                                in: '$$coverImg.url',
                              },
                            },
                            0,
                          ],
                        },
                        { $arrayElemAt: ['$$productDetail.description_images.url', 0] },
                      ],
                    },
                    quantity: '$$orderProduct.qty',
                    price: '$$orderProduct.price',
                    attributes: '$$orderProduct.attributes',
                    sale: '$$orderProduct.sale',
                    saleDiscount: '$$orderProduct.saleDiscount',
                  },
                },
              },
            },
          },

          // Transaction details
          transaction: {
            $cond: {
              if: { $ne: ['$transaction', null] },
              then: {
                _id: '$transaction._id',
                reference: '$transaction.reference',
                amount: '$transaction.amount',
                paymentMethod: '$transaction.paymentMethod',
                paymentGateway: '$transaction.paymentGateway',
                status: '$transaction.status',
                paidAt: '$transaction.paidAt',
                transactionDate: '$transaction.paymentDate',
              },
              else: null,
            },
          },

          // Shipment details
          shipment: {
            $cond: {
              if: { $ne: ['$shipment', null] },
              then: {
                _id: '$shipment._id',
                trackingNumber: '$shipment.trackingNumber',
                status: '$shipment.status',
                courier: '$shipment.courier',
                estimatedDelivery: '$shipment.estimatedDelivery',
                deliveredOn: '$shipment.deliveredOn',
                shippingAddress: '$shipment.shippingAddress',
                trackingHistory: '$shipment.trackingHistory',
                cost: '$shipment.cost',
              },
              else: null,
            },
          },
        },
      },
    ];

    const result = await Order.aggregate(pipeline);
    const order = result[0];

    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Order retrieved successfully',
      data: order,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    return {
      message: 'Failed to fetch order',
      data: null,
      code: 500,
    };
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
      console.log(
        `[OrderService] Return initiated for order ${orderId} - shipment ${order.shipmentId} should be updated`
      );
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
          status: 'Completed',
        },
      },
      {
        $lookup: {
          from: 'shipments',
          localField: 'shipmentId',
          foreignField: '_id',
          as: 'shipment',
        },
      },
      {
        $match: {
          $or: [
            { 'shipment.status': 'Returned' }, // Shipping orders with returned status
            { deliveryType: 'pickup', status: 'Completed' }, // Pickup orders that are completed
          ],
        },
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
const getOrderWithReturns = async (
  orderId: string
): Promise<CustomResponseType<OrderType & { returns: ReturnType[] }>> => {
  try {
    const order = await Order.findById(orderId)
      .populate('user', 'firstName lastName email')
      .populate('products.product', 'name images')
      .lean();

    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }

    // Populate returns from the new Return model
    const returns = (await Return.find({ order: orderId })
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .lean()) as ReturnType[];

    return {
      message: 'Order with returns fetched successfully',
      data: {
        ...order,
        returns,
      } as OrderType & { returns: ReturnType[] },
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

/**
 * Get order statistics for dashboard
 */
const getOrderStatistics = async (
  userId: string
): Promise<
  CustomResponseType<{
    totalOrders: number;
    pendingOrders: number;
    processingOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    failedOrders: number;
  }>
> => {
  try {
    const pipeline = [
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          pending: [{ $match: { status: 'Pending' } }, { $count: 'count' }],
          processing: [{ $match: { status: 'Processing' } }, { $count: 'count' }],
          completed: [{ $match: { status: 'Completed' } }, { $count: 'count' }],
          cancelled: [{ $match: { status: 'Cancelled' } }, { $count: 'count' }],
          failed: [{ $match: { status: 'Failed' } }, { $count: 'count' }],
        },
      },
    ];

    const result = await Order.aggregate(pipeline);
    const stats = result[0];

    return {
      message: 'Order statistics retrieved successfully',
      data: {
        totalOrders: stats.total[0]?.count || 0,
        pendingOrders: stats.pending[0]?.count || 0,
        processingOrders: stats.processing[0]?.count || 0,
        completedOrders: stats.completed[0]?.count || 0,
        cancelledOrders: stats.cancelled[0]?.count || 0,
        failedOrders: stats.failed[0]?.count || 0,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    return {
      message: 'Failed to fetch order statistics',
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
  getOrderStatistics,
};

export default OrderService;
