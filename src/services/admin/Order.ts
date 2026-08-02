import mongoose from 'mongoose';
import Order, { OrderType } from '../../models/Order';
import { TransactionStatus } from '../../models/Transaction';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import AnalyticsService from '../MainAnalyticsService';
import { orderStatusUpdate, type OrderStatusValue } from '@/utils/orderStatusTimestamps';

/**
 * Enriched order response type with all details
 */
export type EnrichedOrder = {
  _id: string;
  orderNumber: string;

  // Order summary
  total: number;
  totalBeforeDiscount: number;
  couponDiscount: number;
  shippingPrice: number;
  taxPrice: number;
  status: OrderType['status'];
  isPaid: boolean;
  deliveryType: 'shipping' | 'pickup' | 'gig';
  gigWaybill?: string | null;
  deliveryStatus?: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  deliveredAt?: Date;

  // Coupon info
  coupon: {
    code?: string;
    discount: number;
    name?: string;
  };

  // Contact information
  contact: {
    name: string;
    phone?: string;
    email: string;
  };

  // Addresses
  shippingAddress: OrderType['shippingAddress'] | null;
  billingAddress: OrderType['shippingAddress'] | null;

  // Products with enriched details
  products: Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    image?: string;
    quantity: number;
    price: number;
    attributes: Array<{ name: string; value: string }>;
    sale?: mongoose.Types.ObjectId | null;
    saleDiscount: number;
  }>;

  // Transaction details
  transaction: {
    _id: mongoose.Types.ObjectId;
    reference: string;
    amount: number;
    paymentMethod: string;
    paymentGateway: string;
    status: string;
    paidAt?: Date;
    transactionDate: Date;
  } | null;

  // Shipment details
  shipment: {
    _id: mongoose.Types.ObjectId;
    trackingNumber: string;
    status: string;
    courier?: string;
    estimatedDelivery?: Date;
    deliveredOn?: Date;
    shippingAddress: {
      firstName: string;
      lastName: string;
      phoneNumber: string;
      address1: string;
      address2?: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      lga?: string;
    };
    trackingHistory: Array<{
      location?: string;
      timestamp: Date;
      description?: string;
    }>;
    cost: number;
  } | null;
};

/**
 * Fetches orders with optional filters and pagination including transaction status.
 * @param page - Current page number (optional).
 * @param limit - Number of orders per page (optional).
 * @param filters - Filters for searching orders.
 */
const getOrders = async (
  page: number = 1,
  limit: number = 15,
  filters?: Partial<{
    status: OrderType['status'];
    orderId: string;
    search: string;
    customerId: string;
    dateRange: { start: Date; end: Date };
    transactionStatus: TransactionStatus | 'all';
  }>
): CustomResponseTypeWithMeta<OrderType[], { total: number; page: number; limit: number; pages: number }> => {
  try {
    const pipeline: mongoose.PipelineStage[] = [];
    const matchStage: Record<string, unknown> = {};


    // Apply filters if provided
    if (filters?.status) matchStage.status = filters.status;
    if (filters?.orderId) matchStage._id = filters.orderId;
    if (filters?.customerId) matchStage.user = filters.customerId;
    if (filters?.dateRange) {
      matchStage.createdAt = { $gte: filters.dateRange.start, $lte: filters.dateRange.end };
    }
    // Lookup user details FIRST (needed for search)
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDetails',
      },
    });
    pipeline.push({
      $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true },
    });

    pipeline.push({ $match: matchStage });

    if (filters?.search) {
      const searchRegex = new RegExp(filters.search, 'i');

      // Check if search string is a valid ObjectId
      let objectIdMatch = null;
      if (mongoose.Types.ObjectId.isValid(filters.search)) {
        objectIdMatch = new mongoose.Types.ObjectId(filters.search);
      }

      pipeline.push({
        $match: {
          $or: [
            // Match exact ObjectId if valid
            ...(objectIdMatch ? [{ _id: objectIdMatch }] : []),
            { 'userDetails.firstName': { $regex: searchRegex } },
            { 'userDetails.lastName': { $regex: searchRegex } },
            { 'userDetails.email': { $regex: searchRegex } },
          ],
        },
      });
    }
    // Handle transaction status filtering
    if (filters?.transactionStatus && filters.transactionStatus !== 'all') {
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
    } else if (!filters?.transactionStatus || filters.transactionStatus === 'all') {
      // Default behavior: only show orders with completed transactions (paid orders)
      pipeline.push({
        $lookup: {
          from: 'transactions',
          localField: 'transactionId',
          foreignField: '_id',
          as: 'transaction',
        },
      });
    }

    // Calculate total items (sum of all product quantities)
    pipeline.push({
      $addFields: {
        totalQty: {
          $sum: '$products.qty',
        },
      },
    });

    // Lookup transaction to get payment status
    pipeline.push({
      $lookup: {
        from: 'transactions',
        localField: 'transactionId',
        foreignField: '_id',
        as: 'transactionDetails',
      },
    });

    // Add paymentStatus field from transaction
    pipeline.push({
      $addFields: {
        paymentStatus: {
          $ifNull: [{ $arrayElemAt: ['$transactionDetails.status', 0] }, 'pending'],
        },
        user: {
          _id: '$userDetails._id',
          firstName: '$userDetails.firstName',
          lastName: '$userDetails.lastName',
          email: '$userDetails.email',
          image: '$userDetails.image',
        },
      },
    });

    // Sort by creation date
    pipeline.push({ $sort: { createdAt: -1 } });

    // Count total documents
    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Order.aggregate(countPipeline);
    const totalOrders = totalResult[0]?.total || 0;

    // Add pagination if specified
    if (page && limit) {
      pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
    }

    // Remove transaction fields from final result (keeping it lean)
    pipeline.push({
      $project: {
        transaction: 0,
        transactionDetails: 0,
        userDetails: 0,
      },
    });

    const orders = await Order.aggregate(pipeline);

    return {
      message: 'Orders retrieved successfully',
      data: orders,
      meta: { total: totalOrders, page, limit, pages: Math.ceil(totalOrders / limit) },

      code: 200,
    };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return {
      message: 'Failed to fetch orders',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches an order by its ID with complete details including products, shipment, and transaction.
 * @param orderId - The ID of the order to fetch.
 */
const getOrderById = async (orderId: string): Promise<CustomResponseType<EnrichedOrder>> => {
  try {
    const pipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(orderId) } },

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
          user: {
            _id: '$userDetails._id',
            firstName: '$userDetails.firstName',
            lastName: '$userDetails.lastName',
            name: '$userDetails.name',
            email: '$userDetails.email',
          },
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

          // Shipping address (only if delivery type is shipping)
          shippingAddress: {
            $cond: {
              if: { $eq: ['$deliveryType', 'shipping'] },
              then: '$shippingAddress',
              else: null,
            },
          },

          // Billing address (same as shipping for now)
          billingAddress: {
            $cond: {
              if: { $eq: ['$deliveryType', 'shipping'] },
              then: '$shippingAddress',
              else: null,
            },
          },

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
              if: {
                $and: [{ $ne: ['$shipment', null] }, { $ifNull: ['$shipment._id', false] }],
              },
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
/**
 * Updates order details for admin.
 * @param orderId - The ID of the order to update.
 * @param updates - The fields to update.
 */
const updateOrderDetails = async (
  orderId: string,
  updates: Partial<Pick<OrderType, 'status' | 'products' | 'shippingAddress' | 'deliveredAt'>>
): Promise<CustomResponseType<null>> => {
  try {
    const previousOrder = await Order.findById(orderId);
    if (!previousOrder) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }

    // Stamp the event timestamp when an admin edit changes status, so an
    // admin-driven cancellation is bucketed by when it happened like any other.
    const statusChanged = updates.status && previousOrder.status !== updates.status;
    const payload = statusChanged
      ? { ...updates, ...orderStatusUpdate(updates.status as OrderStatusValue) }
      : updates;

    await Order.findByIdAndUpdate(orderId, payload, { new: true });

    // Track analytics for status changes
    if (updates.status && previousOrder.status !== updates.status) {
      // If the order was completed, track it as a successful sale
      if (updates.status === 'Completed') {
        AnalyticsService.trackOrderCompleted(orderId, previousOrder.total).catch((err) =>
          console.error('Failed to track order completion analytics:', err)
        );
      }
    }

    return {
      message: 'Order updated successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating order details:', error);
    return {
      message: 'Failed to update order',
      data: null,
      code: 500,
    };
  }
};

/**
 * Cancels an order by its ID.
 * @param orderId - The ID of the order to cancel.
 */
const cancelOrder = async (orderId: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndDelete(orderId);
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    // Track order cancellation analytics
    AnalyticsService.trackOrderReturned(orderId).catch((err) =>
      console.error('Failed to track order cancellation analytics:', err)
    );
    return {
      message: 'Order canceled successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error canceling order:', error);
    return {
      message: 'Failed to cancel order',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates the delivery timeline of an order.
 * @param orderId - The ID of the order to update.
 * @param timeline - The new delivery timeline.
 */
const updateDeliveryTimeline = async (orderId: string, timeline: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndUpdate(orderId, { timeline });
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Delivery timeline updated successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating delivery timeline:', error);
    return {
      message: 'Failed to update delivery timeline',
      data: null,
      code: 500,
    };
  }
};

/**
 * Rejects an order by its ID.
 * @param orderId - The ID of the order to reject.
 */
const rejectOrder = async (orderId: string): Promise<CustomResponseType<null>> => {
  try {
    // Was writing 'Not Processed', which is not in the status enum — findByIdAndUpdate
    // skips validators by default, so it wrote silently and no report ever matched
    // those orders. A rejected order is a cancellation.
    const order = await Order.findByIdAndUpdate(orderId, orderStatusUpdate('Cancelled'));
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Order rejected successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error rejecting order:', error);
    return {
      message: 'Failed to reject order',
      data: null,
      code: 500,
    };
  }
};

/**
 * Fetches all returned orders.
 */
const getAllReturns = async ({
  page = 1,
  limit = 10,
}: {
  page?: number;
  limit?: number;
}): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>> => {
  try {
    const skip = (page - 1) * limit;
    const [returnedOrders, totalOrders] = await Promise.all([
      Order.find({ deliveryStatus: 'Returned' }).skip(skip).limit(limit),
      Order.countDocuments({ deliveryStatus: 'Returned' }),
    ]);

    return {
      message: 'Returned orders retrieved successfully',
      data: { orders: returnedOrders, totalOrders },
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
 * Fetches the 15 most ordered products within a specified time frame.
 * @param startDate - The start date of the time frame.
 * @param endDate - The end date of the time frame.
 */
const getTopOrderedProducts = async (
  startDate: Date,
  endDate: Date
): Promise<CustomResponseType<{ productId: string; totalQuantity: number }[]>> => {
  try {
    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $unwind: '$products',
      },
      {
        $group: {
          _id: '$products.product',
          totalQuantity: { $sum: '$products.qty' },
        },
      },
      {
        $sort: { totalQuantity: -1 },
      },
      {
        $limit: 15,
      },
    ]);

    return {
      message: 'Top ordered products retrieved successfully',
      data: result.map((item) => ({ productId: item._id, totalQuantity: item.totalQuantity })),
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching top ordered products:', error);
    return {
      message: 'Failed to fetch top ordered products',
      data: null,
      code: 500,
    };
  }
};

const OrderService = {
  getOrderById,
  cancelOrder,
  updateDeliveryTimeline,
  rejectOrder,
  updateOrderDetails,
  getOrders,
  getAllReturns,
  getTopOrderedProducts,
};

export default OrderService;
