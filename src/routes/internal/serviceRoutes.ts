import { Router, Request, Response } from 'express';
import Order from '@/models/Order';
import Transaction from '@/models/Transaction';
import Product from '@/models/Product';
import { verifyInternalService } from '@/middleware/auth';
import { logger } from '@/lib/logger';
import eventPublisher from '@/events/eventPublisher';
import TransactionService from '@/services/TransactionService';
import { reverseSaleCountersOnCancel } from '@/helpers/saleOrderUtils';
import mongoose from 'mongoose';
const router = Router();

// Apply internal service authentication to all routes
router.use(verifyInternalService);

/**
 * GET /api/internal/orders/pending-payments
 * Fetches orders with isPaid=false and status=Pending created within the last 30 minutes
 * Used for timeout recovery on event-bus restart
 */
router.get('/orders/pending-payments', async (req: Request, res: Response) => {
  try {
    // Calculate cutoff time (30 minutes ago)
    const CART_RESTORATION_TIMEFRAME = parseInt(process.env.CART_RESTORATION_TIMEFRAME || '1800000');
    const cutoffTime = new Date(Date.now() - CART_RESTORATION_TIMEFRAME);

    const pendingOrders = await Order.find({
      isPaid: false,
      status: 'Pending',
      createdAt: { $gte: cutoffTime }, // Only orders created within timeframe
    })
      .select('_id createdAt')
      .lean();

    const formattedOrders = pendingOrders.map((order) => ({
      _id: order._id.toString(),
      createdAt: order.createdAt,
    }));

    logger.info(`Fetched ${formattedOrders.length} pending orders created after ${cutoffTime.toISOString()}`);

    return res.status(200).json({
      message: 'Pending orders fetched successfully',
      orders: formattedOrders,
    });
  } catch (error) {
    logger.error('Error fetching pending orders:', error);
    return res.status(500).json({
      message: 'Failed to fetch pending orders',
      code: 'FETCH_FAILED',
    });
  }
});

/**
 * POST /api/internal/orders/verify-and-restore-stock
 * Verifies Paystack transaction status and restores stock if payment abandoned/failed
 * Handles all Paystack statuses: success, pending, ongoing, abandoned, failed, etc.
 */
router.post('/orders/verify-and-restore-stock', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        message: 'Missing required field: orderId',
        code: 'INVALID_REQUEST',
      });
    }

    // 1. Find the order and extract items
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    }

    // Extract items from order for stock restoration
    const items = order.products
      .filter((item) => item.product && item.qty)
      .map((item) => ({
        productId: item.product!.toString(),
        quantity: item.qty!,
      }));

    // 2. Check if already paid
    if (order.isPaid) {
      logger.info(`Order ${orderId} is already paid - skipping stock restoration`);
      return res.status(200).json({
        message: 'Order is already paid',
        code: 'ALREADY_PAID',
        action: 'none',
      });
    }

    // 3. Find the transaction
    const transaction = await Transaction.findOne({ orderId: order._id });
    if (!transaction) {
      // No transaction found - restore stock immediately
      logger.warn(`No transaction found for order ${orderId} - restoring stock`);
      await restoreStock(orderId, items);
      return res.status(200).json({
        message: 'No transaction found - stock restored',
        code: 'NO_TRANSACTION',
        action: 'stock_restored',
      });
    }

    // 4. Use TransactionService to verify payment
    const verificationResult = await TransactionService.verifyPayment(transaction.reference);

    if (verificationResult.code !== 200 || !verificationResult.data) {
      logger.error(`Transaction verification failed for order ${orderId}:`, verificationResult.message);
      return res.status(500).json({
        message: 'Transaction verification failed',
        code: 'VERIFICATION_FAILED',
        details: verificationResult.message,
      });
    }

    const verifiedTransaction = verificationResult.data;
    const paymentStatus = verifiedTransaction.status;
    logger.info(`Verified transaction status for order ${orderId}: ${paymentStatus}`);

    // 5. Handle different transaction statuses
    switch (paymentStatus) {
      case 'completed':
        // Payment succeeded after timeout - order should already be marked as paid by verifyPayment
        logger.warn(`Payment completed late for order ${orderId} - already marked as paid`);

        // Ensure ORDER_SUCCESSFUL event is emitted with complete data
        const updatedOrder = await Order.findById(orderId).populate([
          {
            path: 'user',
            select: 'email firstName lastName',
          },
          {
            path: 'products.product',
            select: 'name description_images category price',
          },
          {
            path: 'shipmentId',
            select: 'courier',
          },
        ]);

        if (updatedOrder) {
          const populatedUser = updatedOrder.user as unknown as {
            email: string;
            firstName: string;
            lastName: string;
          };

          const populatedProducts = updatedOrder.products as unknown as Array<{
            product: {
              name: string;
              description_images?: string[];
              category?: string;
              price?: number;
            };
            qty?: number;
            price?: number;
          }>;

          // Determine courier and address based on delivery type
          let courier = 'Standard Shipping';
          let address = '';

          if (updatedOrder.deliveryType === 'pickup') {
            courier = 'Pickup';
            address = process.env.STORE_ADDRESS || 'Store Pickup';
          } else {
            // For shipping, try to get courier from shipment if available
            const populatedShipment = updatedOrder.shipmentId as unknown as { courier?: string } | null;
            courier = populatedShipment?.courier || 'Standard Shipping';
            address = `${updatedOrder.shippingAddress?.address1 || ''}, ${updatedOrder.shippingAddress?.city || ''}, ${
              updatedOrder.shippingAddress?.state || ''
            }`.trim();
          }

          await eventPublisher.publishOrderSuccessful({
            email: populatedUser.email,
            firstName: populatedUser.firstName,
            purchaseDate: updatedOrder.createdAt,
            invoiceNumber: updatedOrder._id.toString(),
            shipping: {
              courier,
              address,
            },
            products: populatedProducts.map((item) => ({
              name: item.product.name,
              imagePath: item.product.description_images?.[0] || '',
              category: item.product.category,
              price: item.price || item.product.price || 0,
              quantity: item.qty || 0,
              subtotal: (item.price || item.product.price || 0) * (item.qty || 0),
            })),
            payment: {
              totalShopping: updatedOrder.totalBeforeDiscount || updatedOrder.total || 0,
              shipping: updatedOrder.shippingPrice || 0,
              tax: updatedOrder.taxPrice || 0,
              discount: updatedOrder.couponDiscount || 0,
              subtotal: updatedOrder.total || 0,
            },
            orderStatusLink: `${process.env.FRONTEND_URL}/orders/${updatedOrder._id.toString()}`,
          });
        }

        return res.status(200).json({
          message: 'Payment succeeded after timeout - order marked as paid',
          code: 'PAYMENT_SUCCEEDED_LATE',
          action: 'marked_paid',
        });

      case 'pending':
        // Payment still in progress - do not restore stock yet
        logger.info(`Payment still in progress (${paymentStatus}) for order ${orderId} - keeping timeout active`);
        return res.status(200).json({
          message: `Payment is ${paymentStatus} - keeping timeout active`,
          code: 'PAYMENT_IN_PROGRESS',
          action: 'wait',
          paymentStatus,
        });

      case 'failed':
      case 'cancelled':
      default:
        // Payment failed/cancelled - stock already restored by verifyPayment
        logger.info(`Payment ${paymentStatus} for order ${orderId} - stock already restored by verifyPayment`);

        return res.status(200).json({
          message: `Payment ${paymentStatus} - stock already restored`,
          code: 'STOCK_RESTORED',
          action: 'stock_restored',
          paymentStatus,
        });
    }
  } catch (error) {
    logger.error('Error in verify-and-restore-stock:', error);
    return res.status(500).json({
      message: 'Internal server error during verification',
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * Helper function to restore stock and reverse sale counters for order items
 * Items are extracted from the order document
 */
async function restoreStock(orderId: string, items: Array<{ productId: string; quantity: number }>): Promise<void> {
  try {
    const bulkUpdates = items.map((item) => ({
      updateOne: {
        filter: { _id: item.productId },
        update: { $inc: { stock: item.quantity } },
      },
    }));

    await Product.bulkWrite(bulkUpdates);
    logger.info(`Stock restored for ${items.length} products in order ${orderId}`);

    // Reverse sale counters if order has snapshots
    const order = await Order.findById(orderId);
    if (order && order.products) {
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
        logger.info(`Sale counters reversed for order ${orderId}`);
      } catch (err) {
        await session.abortTransaction();
        logger.error(`Failed to reverse sale counters for order ${orderId}:`, err);
      } finally {
        session.endSession();
      }
    }
  } catch (error) {
    logger.error(`Failed to restore stock for order ${orderId}:`, error);
    throw error;
  }
}

export default router;
