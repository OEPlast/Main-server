import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import OrderService from '../services/orderService';
import { OrderType } from '@/models/Order';
// import { CartType } from '@/models/Cart';
import PaymentService from '@/services/TransactionService';
import User from '@/models/User';
import LogisticsService from '@/services/LogisticsService';
// import CartService from '@/services/cartService';
// import Cart from '@/models/Cart';
import { validateAndCorrectCart, FrontendCartData } from '@/services/CartValidationService';

// Fetch paginated order history for a user
export const getOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const { page = 1, limit = 10, status, deliveryStatus, transactionStatus } = req.query;

    const filters = { 
      userId, 
      status, 
      deliveryStatus, 
      transactionStatus 
    } as unknown as {
      userId: string;
      status?: OrderType['status'];
      deliveryStatus?: OrderType['deliveryStatus'];
      transactionStatus?: import('../models/Transaction').TransactionStatus | 'all';
    };

    const { data, message, code } = await OrderService.getOrderHistory(~~page, ~~limit, filters);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrders:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;

    const { data, message, code } = await OrderService.getOneOrder({ orderId: id, userId });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Secure checkout with simplified price validation
export const secureCheckout = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId!;

    const {
      items, // Frontend cart items
      shippingAddress,
      paymentMethod = 'paystack',
      couponCodes, // Change from appliedCoupons to couponCodes
      taxPrice,
      subtotal,
      total,
      totalDiscount,
      estimatedShipping,
      deliveryType = 'shipping', // New field for delivery type
      shippingCost: frontendShippingCost, // Frontend calculated shipping cost for validation
    } = req.body as {
      items: Array<{
        _id?: string;
        product: string;
        qty: number;
        selectedAttributes?: Array<{ name: string; value: string }>;
        unitPrice: number;
        totalPrice: number;
        sale?: string;
        appliedDiscount?: number;
        discountAmount?: number;
        productSnapshot?: {
          name: string;
          price: number;
          sku: number;
        };
      }>;
      shippingAddress?: OrderType['shippingAddress'];
      paymentMethod?: string;
      couponCodes?: string[]; // Change from appliedCoupons to couponCodes array
      taxPrice?: number;
      subtotal: number;
      total: number;
      totalDiscount: number;
      estimatedShipping?: { cost: number; days: number };
      deliveryType?: 'shipping' | 'pickup';
      shippingCost?: number; // Frontend calculated shipping cost
    };

    // Validate that items are provided
    if (!items || !items.length) {
      return res.status(400).json({
        message: 'No items provided for checkout',
        data: null,
      });
    }

    // Validate shipping address - only required for shipping delivery type
    if (deliveryType === 'shipping' && !shippingAddress) {
      return res.status(400).json({
        message: 'Shipping address is required for shipping delivery',
        data: null,
      });
    }

    // Step 1: Calculate shipping cost FIRST (before validation)
    let shippingCost = 0;

    if (deliveryType === 'shipping') {
      // Calculate shipping cost for delivery
      if (!shippingAddress) {
        return res.status(400).json({
          message: 'Shipping address is required for shipping delivery',
          data: null,
        });
      }

      const rawShippingCost = await LogisticsService.calculateProgressiveShipping(
        items.map((item) => ({
          productId: item.product.toString(),
          quantity: item.qty,
        })),
        {
          countryName: shippingAddress.country || 'Nigeria',
          stateCode: shippingAddress.state || '',
          lgaName: shippingAddress.city || '',
        }
      );

      // Round shipping cost to 2 decimal places
      shippingCost = Math.round(rawShippingCost * 100) / 100;

      // Note: Don't validate shipping cost mismatch - we'll correct it automatically like product prices
    } else {
      // For pickup delivery, shipping cost is 0
      shippingCost = 0;
    }

    // Step 2: Validate and correct cart pricing (after shipping calculation)
    const frontendCartData: FrontendCartData = {
      items,
      couponCodes: couponCodes || [], // Pass coupon codes instead of appliedCoupons
      subtotal,
      total: total - shippingCost, // Remove shipping from total for cart validation
      totalDiscount,
      estimatedShipping: estimatedShipping || { cost: 0, days: 0 },
    };

    // For checkout, we validate coupon codes and calculate discounts on the backend
    const validationResult = await validateAndCorrectCart(frontendCartData, couponCodes);

    if (!validationResult.data) {
      return res.status(500).json({
        message: 'Failed to validate cart data',
        data: null,
      });
    }

    // Step 3: If validation fails, return corrected cart WITH shipping cost included
    if (validationResult.data.needsUpdate) {
      const correctedCartTotal = Math.round((validationResult.data.correctedCart.total + shippingCost) * 100) / 100;
      const updatedChanges = [...validationResult.data.changes];

      // Add shipping cost change if different from frontend
      if (frontendShippingCost !== undefined && frontendShippingCost !== shippingCost) {
        updatedChanges.push(
          `Shipping cost updated: ₦${frontendShippingCost.toLocaleString()} → ₦${shippingCost.toLocaleString()}`
        );
      }

      // Add total change including shipping
      if (total !== correctedCartTotal) {
        updatedChanges.push(
          `Final total updated: ₦${total.toLocaleString()} → ₦${correctedCartTotal.toLocaleString()} (including shipping)`
        );
      }

      return res.status(400).json({
        message: 'Cart needs to be updated',
        data: {
          needsUpdate: true,
          correctedCart: {
            ...validationResult.data.correctedCart,
            shippingCost,
            deliveryType,
            total: correctedCartTotal, // Add shipping back to corrected total
          },
          changes: updatedChanges,
        },
      });
    }

    // Use backend-calculated totals (not frontend-provided ones)
    const backendCalculatedSubtotal = validationResult.data.correctedCart.subtotal;
    const backendCalculatedCouponDiscount = validationResult.data.correctedCart.couponDiscount;

    // Step 4: Check if ONLY shipping cost needs correction (cart validation passed)
    const expectedTotal = Math.round((total - (frontendShippingCost || 0) + shippingCost) * 100) / 100;
    if (
      frontendShippingCost !== undefined &&
      Math.abs(frontendShippingCost - shippingCost) > 1 &&
      Math.abs(total - expectedTotal) > 1
    ) {
      return res.status(400).json({
        message: 'Shipping cost needs to be updated',
        data: {
          needsUpdate: true,
          correctedCart: {
            ...validationResult.data.correctedCart,
            shippingCost,
            deliveryType,
            total: expectedTotal,
          },
          changes: [
            `Shipping cost updated: ₦${frontendShippingCost.toLocaleString()} → ₦${shippingCost.toLocaleString()}`,
            `Total updated: ₦${total.toLocaleString()} → ₦${expectedTotal.toLocaleString()}`,
          ],
        },
      });
    }

    // Step 5: Use backend-calculated totals for order creation
    const finalSubtotal = Math.round(backendCalculatedSubtotal * 100) / 100;
    const finalCouponDiscount = Math.round(backendCalculatedCouponDiscount * 100) / 100;
    const finalTotal = Math.round((finalSubtotal - finalCouponDiscount + shippingCost) * 100) / 100;

    // Step 6: Create order with validated data
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
        saleType: undefined, // Will be resolved during order processing
        saleDiscount: item.appliedDiscount || 0,
      })),
      shippingAddress: deliveryType === 'shipping' ? shippingAddress : undefined, // Only include address for shipping
      deliveryType, // Add delivery type to order
      paymentMethod,
      total: finalTotal,
      totalBeforeDiscount: finalSubtotal,
      couponCodes: couponCodes || [], // Pass validated coupon codes
      couponDiscount: finalCouponDiscount,
      shippingPrice: shippingCost,
      taxPrice: taxPrice ?? 0,
      isPaid: false,
      status: 'Pending' as OrderType['status'],
      deliveryStatus: 'In-Warehouse' as OrderType['deliveryStatus'],
    } as unknown as Parameters<typeof OrderService.placeOrderWithStockValidation>[0];

    // Step 7: Place the order with stock validation
    const placed = await OrderService.placeOrderWithStockValidation(orderInput);
    if (!placed.data) {
      return res.status(placed.code).json({
        message: placed.message,
        data: null,
      });
    }

    // Step 8: Initialize payment
    const userDoc = await User.findById(userId).select('email');
    if (!userDoc?.email) {
      return res.status(400).json({
        message: 'User email not found for payment initialization',
        data: null,
      });
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
      throw new Error(paymentInit.message);
    }

    // Step 9: Return success
    return res.status(200).json({
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
          items: orderInput.products,
          status: 'Pending',
          isPaid: false,
        },
        validation: {
          priceValidated: true,
          totalDiscrepancy: 0,
        },
        payment: paymentInit.data || null,
      },
    });
  } catch (error) {
    console.error('Error in secureCheckout:', error);
    return res.status(500).json({
      message: 'Internal server error during secure checkout',
      data: null,
    });
  }
};

// Update an order
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;
    const { address } = req.body as { address?: OrderType['shippingAddress'] };

    const { message, code } = await OrderService.updateOrderDetails(id, userId, address);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in updateOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

//  Cancel an order
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;

    const { message, code } = await OrderService.cancelOrder(id, userId);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in deleteOrder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Initiate a return for an order
export const initiateReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).userId!;

    const { message, code } = await OrderService.initiateReturn(id, userId);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in initiateReturn:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllReturns = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { page = 1, limit = 10 } = req.query;

    const { data, message, code } = await OrderService.getAllReturns({ userId, page: ~~page, limit: ~~limit });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAllReturns:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Calculate shipping cost for checkout preview (from cart data)
export const calculateShipping = async (req: Request, res: Response) => {
  try {
    const {
      items,
      shippingAddress,
      deliveryType = 'shipping',
    } = req.body as {
      items: Array<{
        product: string;
        qty: number;
        selectedAttributes?: Array<{ name: string; value: string }>;
        unitPrice: number;
        totalPrice: number;
      }>;
      shippingAddress?: {
        country?: string;
        state?: string;
        city?: string;
      };
      deliveryType?: 'shipping' | 'pickup';
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart items are required', code: 400 });
    }

    // If delivery type is pickup, return zero shipping cost
    if (deliveryType === 'pickup') {
      return res.status(200).json({
        message: 'Shipping cost calculated successfully - Pickup selected',
        data: {
          shippingCost: 0,
          deliveryType: 'pickup',
          destination: null,
          currency: 'NGN',
          itemsSubtotal: items.reduce((sum, item) => sum + item.totalPrice, 0),
          estimatedTotal: items.reduce((sum, item) => sum + item.totalPrice, 0),
        },
        code: 200,
      });
    }

    // For shipping delivery, validate shipping address
    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required for shipping delivery', code: 400 });
    }

    try {
      // Prepare cart items for logistics calculation
      const cartItems = items.map((item) => ({
        productId: item.product.toString(),
        quantity: item.qty,
      }));

      // Prepare destination from shipping address
      const destination = {
        countryName: shippingAddress.country || 'Nigeria',
        stateCode: shippingAddress.state || 'LA', // Default to Lagos if not provided
        lgaName: 'Default', // LGA not provided in shipping address, use default
      };

      // Calculate progressive shipping cost
      const rawShippingCost = await LogisticsService.calculateProgressiveShipping(cartItems, destination);
      const shippingCost = Math.round(rawShippingCost * 100) / 100;

      return res.status(200).json({
        message: 'Shipping cost calculated successfully',
        data: {
          shippingCost,
          deliveryType: 'shipping',
          destination,
          currency: 'NGN',
          itemsSubtotal: items.reduce((sum, item) => sum + item.totalPrice, 0),
          estimatedTotal:
            Math.round((items.reduce((sum, item) => sum + item.totalPrice, 0) + shippingCost) * 100) / 100,
        },
        code: 200,
      });
    } catch (logisticsError) {
      console.error('Logistics calculation error:', logisticsError);
      return res.status(400).json({
        message: 'Unable to calculate shipping cost. Please verify your shipping address.',
        code: 400,
      });
    }
  } catch (error) {
    console.error('Error in calculateShipping:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const OrderController = {
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  initiateReturn,
  getAllReturns,
  calculateShipping,
  secureCheckout,
};
export default OrderController;
