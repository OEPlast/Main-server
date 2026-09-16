import mongoose from 'mongoose';
import { cancelOrder as cancelOrderLifecycle } from '@/services/orders/orderLifecycle';
import Order, { OrderType } from '../models/Order';
import Product from '@/models/Product';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import { SaleOrderProduct, updateSaleCountersOnOrder } from '@/helpers/saleOrderUtils';
import { publishLiveProductUpdates } from '@/helpers/liveProductUpdates';
import eventPublisher from '@/events/eventPublisher';
import Coupon, { CouponType as CouponSchemaType } from '@/models/Coupon';
import CouponRedemption from '@/models/CouponRedemption';
import ShipmentService from '@/services/ShipmentService';
import Return, { ReturnType } from '../models/Return';
import { EnrichedOrder } from './admin/Order';
import type { CouponDoc, OrderDataInput, PlaceOrderResponse } from '@/types/order';
import { validateCouponCodes } from '@/helpers/couponUtils';
import { priceCart, roundKobo, toCouponLines } from '@/services/pricing';

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

/** Thrown when the priced total no longer matches what the shopper confirmed at checkout. */
class PriceChangedError extends Error {}

const placeOrderWithStockValidation = async (
  orderData: OrderDataInput,
  options: { expectedTotal?: number } = {}
): Promise<CustomResponseType<PlaceOrderResponse>> => {
  const { expectedTotal } = options;
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

    // Price every line with the shared pricing module, inside the transaction so the sale
    // counters read here are the ones this transaction increments. The sale is found by product,
    // never taken from the input.
    const priced = await priceCart(
      products.map((item) => ({
        product: item.product!,
        qty: Number(item.qty || 0),
        selectedAttributes: (item.attributes || []) as { name: string; value: string }[],
      })),
      { session }
    );
    if (priced.missingProductIds.length > 0) {
      throw new Error('One or more products were not found.');
    }

    products.forEach((item, index) => {
      const line = priced.lines[index]!;
      if (line.qty < 1) throw new Error('Invalid quantity for product.');
      item.price = line.unitPrice;
      item.sale = line.sale ? (new mongoose.Types.ObjectId(line.sale.saleId) as unknown as typeof item.sale) : undefined;
      item.saleType = line.sale?.type;
      item.saleVariantIndex = line.sale?.variantIndex;
      // Naira taken off each unit by the sale (the admin order screen shows it under the unit price).
      item.saleDiscount = line.sale?.unitDiscount ?? 0;
    });

    const itemsSubtotal = priced.itemsSubtotal;
    const couponLines = toCouponLines(priced.lines);

    // The single legacy `couponApplied` code goes through the same path as `couponCodes`.
    const requestedCodes =
      orderData.couponCodes && orderData.couponCodes.length > 0
        ? orderData.couponCodes
        : orderData.couponApplied
          ? [orderData.couponApplied]
          : [];

    const couponValidation =
      requestedCodes.length > 0
        ? await validateCouponCodes({
            couponCodes: requestedCodes,
            lines: couponLines,
            userId: orderData.user as mongoose.Types.ObjectId,
            session,
          })
        : { validCoupons: [], invalidCoupons: [], totalDiscount: 0 };

    const appliedCoupons = couponValidation.validCoupons;
    const appliedCouponDocs: CouponDoc[] = appliedCoupons.map((v) => v.couponDoc);
    const finalCouponDiscount = couponValidation.totalDiscount;
    const couponResults: Array<{ code: string; applied: boolean; reason?: string; discount?: number }> = [
      ...appliedCoupons.map((v) => ({ code: v.code, applied: true, discount: v.discount })),
      ...couponValidation.invalidCoupons.map((v) => ({ code: v.code, applied: false, reason: v.reason })),
    ];

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

    // Delivery was quoted by CheckoutService in this same request (free-delivery threshold
    // included); order creation records that figure rather than quoting again with different
    // inputs, which is how the charged total used to drift from the one shown.
    const shipping = roundKobo(Number(orderData.shippingPrice || 0));
    const tax = roundKobo(Number(orderData.taxPrice || 0));
    const subtotalAfterCoupon = roundKobo(Math.max(0, itemsSubtotal - finalCouponDiscount));
    const finalTotal = roundKobo(subtotalAfterCoupon + shipping + tax);

    // The shopper confirmed `expectedTotal` at checkout. If anything moved in between (a sale sold
    // out, a coupon hit its limit), stop rather than charge a different amount.
    if (typeof expectedTotal === 'number' && Math.abs(finalTotal - expectedTotal) > 0.01) {
      throw new PriceChangedError(
        `Prices changed while you were checking out (₦${expectedTotal.toLocaleString('en-NG')} → ₦${finalTotal.toLocaleString('en-NG')}). Please review your cart and try again.`
      );
    }

    // What each sale gave away, per line, for promotion reporting.
    const flashSaleApplied = priced.lines
      .filter((line) => line.sale && line.saleDiscountTotal > 0)
      .map((line) => ({
        flashSale: new mongoose.Types.ObjectId(line.sale!.saleId),
        product: new mongoose.Types.ObjectId(line.productId),
        attributeName: line.sale!.attributeName,
        attributeValue: line.sale!.attributeValue,
        discount: line.saleDiscountTotal,
      }));

    const primaryCoupon = appliedCouponDocs[0];
    const order = new Order({
      ...orderData,
      total: finalTotal,
      totalBeforeDiscount: priced.listSubtotal,
      shippingPrice: shipping,
      products,
      couponDiscount: finalCouponDiscount,
      flashSaleApplied,
      ...(primaryCoupon
        ? {
            coupon: primaryCoupon._id,
            couponCode: primaryCoupon.coupon,
            couponApplied: appliedCouponDocs.map((c) => c.coupon).join(', '),
            couponSnapshot: {
              discount: primaryCoupon.discount,
              discountType: primaryCoupon.discountType || 'percentage',
              appliesTo: primaryCoupon.appliesTo || { scope: 'order' },
            } as OrderType['couponSnapshot'],
          }
        : { coupon: undefined, couponCode: undefined, couponApplied: undefined, couponSnapshot: undefined }),
    });

    await order.save({ session });

    // One redemption row per applied coupon, with that coupon's own discount.
    if (appliedCoupons.length > 0) {
      await CouponRedemption.create(
        appliedCoupons.map(({ couponDoc, discount }) => ({
          coupon: couponDoc._id,
          user: orderData.user as mongoose.Types.ObjectId,
          order: order._id as mongoose.Types.ObjectId,
          amountDiscounted: discount,
          couponType: couponDoc.couponType,
        })),
        { session, ordered: true }
      );

      for (const { couponDoc, discount } of appliedCoupons) {
        const update: mongoose.UpdateQuery<CouponSchemaType> = {
          $inc: { timesUsed: 1 },
          ...(couponDoc.couponType === 'one-off-user'
            ? { $addToSet: { usedBy: orderData.user as mongoose.Types.ObjectId } }
            : {}),
        } as unknown as mongoose.UpdateQuery<CouponSchemaType>;

        await Coupon.updateOne({ _id: couponDoc._id }, update, { session });

        await eventPublisher.publishCouponRedeemed({
          couponId: couponDoc._id.toString(),
          userId: orderData.user.toString(),
          orderId: order._id.toString(),
          amountDiscounted: discount,
          code: couponDoc.coupon,
        });
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Stock went down and sale counters (boughtCount) went up: push them to open product pages.
    void publishLiveProductUpdates(productIds);
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
    if (error instanceof PriceChangedError) {
      return { message: error.message, data: null, code: 409 };
    }
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

/**
 * A customer cancels their own order. Stock, sale allocation and coupon usage come back; if the
 * order was paid, the refund is flagged for staff to authorize rather than paid out automatically.
 */
const cancelOrder = async (orderId: string, userId: string): Promise<CustomResponseType> => {
  const { message, code } = await cancelOrderLifecycle({
    orderId,
    customerId: userId,
    by: 'customer',
    refund: 'await_staff',
    notifyCustomer: true,
  });
  return { message, data: null, code };
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
          orderNumber: { $ifNull: ['$orderNumber', { $toString: '$_id' }] },

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

          // Falls back to the shipping address for orders placed before billing addresses were
          // captured, which is what they effectively were.
          billingAddress: { $ifNull: ['$billingAddress', '$shippingAddress'] },
          billingSameAsShipping: { $ifNull: ['$billingSameAsShipping', true] },

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
