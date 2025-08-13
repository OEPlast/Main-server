import mongoose from 'mongoose';
import Order, { OrderType } from '../models/Order';
import Product from '@/models/Product';
import { CustomResponseType } from '@/types';
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

  // Static discounts
  const variantDiscountPct = typeof variant?.discount === 'number' ? variant.discount : undefined;
  const productDiscountPct = typeof product.discount === 'number' ? product.discount : 0;
  const staticDiscountPct = typeof variantDiscountPct === 'number' ? variantDiscountPct : productDiscountPct;
  if (staticDiscountPct && staticDiscountPct > 0) unit = Math.max(0, unit - (unit * staticDiscountPct) / 100);

  // Sale discount overrides static precedence (applied on resolved base price, not tiered?)
  const salePct = typeof saleContext?.discount === 'number' ? saleContext.discount : 0;
  if (salePct > 0) {
    const baseForSale = typeof variantPrice === 'number' ? variantPrice : product.price;
    unit = Math.max(0, baseForSale - (baseForSale * salePct) / 100);
  }

  return { unitPrice: unit, base, discountAppliedPct: salePct > 0 ? salePct : staticDiscountPct || 0 };
}

/**
 * Fetches paginated orders for user with optional filters.
 * @param page - Current page number.
 * @param limit - Number of orders per page.
 * @param filters - Filters for searching orders.
 */
const getOrderHistory = async (
  page: number,
  limit: number,
  filters: { userId: string; status?: OrderType['status']; deliveryStatus?: OrderType['deliveryStatus'] }
): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>> => {
  try {
    const query: Record<string, unknown> = {};

    if (filters.userId) {
      query.user = filters.userId;
    }

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.deliveryStatus) {
      query.deliveryStatus = filters.deliveryStatus;
    }

    const orders = await Order.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalOrders = await Order.countDocuments(query);

    return {
      message: 'Orders retrieved successfully',
      data: { orders, totalOrders },
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
 * Places a new order with stock validation.
 * @param orderData - The data for the new order.
 */

// Accept user as string (will be cast by Mongoose) or ObjectId
// Make array fields optional for input ergonomics
type OrderDataInput = Omit<OrderType, 'createdAt' | 'updatedAt' | 'user' | 'shippingProgress' | 'flashSaleApplied'> & {
  user: string | mongoose.Types.ObjectId;
  shippingProgress?: OrderType['shippingProgress'];
  flashSaleApplied?: OrderType['flashSaleApplied'];
};

const placeOrderWithStockValidation = async (orderData: OrderDataInput): Promise<CustomResponseType<OrderType>> => {
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
          const { available, discount } = checkSaleAvailability(sale, item.attributes);
          if (available) saleDiscount = typeof discount === 'number' ? discount : 0;
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
      item.price = pricing.unitPrice;
      itemsSubtotal += pricing.unitPrice * qty;
      itemsBaseSubtotal += pricing.base * qty;
    }

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
    // Ensure products are typed as SaleOrderProduct[] for updateSaleCountersOnOrder
    await updateSaleCountersOnOrder(products as SaleOrderProduct[], session);

    // Compute final totals
    const shipping = Number(orderData.shippingPrice || 0);
    const tax = Number(orderData.taxPrice || 0);
    const computedTotal = itemsSubtotal + shipping + tax;

    // Create the order with recomputed totals
    const order = new Order({
      ...orderData,
      total: computedTotal,
      totalBeforeDiscount: itemsBaseSubtotal,
      products,
    });
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Track order analytics after successful transaction
    AnalyticsService.trackOrderPlaced(order._id.toString(), order.total).catch((err) =>
      console.error('Failed to track order analytics:', err)
    );

    return {
      message: 'Order placed successfully',
      data: order,
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

    if (order.deliveryStatus !== 'In-Warehouse') {
      throw new Error('Order cannot be canceled. It may have already been shipped.');
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

    if (order.deliveryStatus !== 'Delivered') {
      throw new Error('Only delivered orders can be returned.');
    }

    // Update order status to Returned
    order.deliveryStatus = 'Returned';
    await order.save({ session });

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
    const pipeline = [
      { $match: { user: userId, deliveryStatus: 'Returned' } },
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

const OrderService = {
  getOrderHistory,
  placeOrderWithStockValidation,
  cancelOrder,
  updateOrderDetails,
  getOneOrder,
  initiateReturn,
  getAllReturns,
};

export default OrderService;
