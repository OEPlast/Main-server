import { Router, Request, Response } from 'express';
import Order from '@/models/Order';
import Transaction from '@/models/Transaction';
import Product from '@/models/Product';
import { verifyInternalService } from '@/middleware/auth';
import { logger } from '@/lib/logger';
import eventPublisher from '@/events/eventPublisher';
import TransactionService from '@/services/TransactionService';

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
      .select('_id user products createdAt')
      .lean();

    const formattedOrders = pendingOrders.map((order) => ({
      orderId: order._id.toString(),
      userId: order.user.toString(),
      items: order.products.map((item) => ({
        productId: item.product?.toString() || '',
        quantity: item.qty || 0,
      })),
      createdAt: order.createdAt,
    }));

    logger.info(`Fetched ${formattedOrders.length} pending orders created after ${cutoffTime.toISOString()}`);

    return res.status(200).json({
      message: 'Pending orders fetched successfully',
      data: formattedOrders,
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
    const { orderId, items } = req.body;

    if (!orderId || !items || !Array.isArray(items)) {
      return res.status(400).json({
        message: 'Missing required fields: orderId and items array',
        code: 'INVALID_REQUEST',
      });
    }

    // 1. Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    }

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

        // Ensure ORDER_SUCCESSFUL event is emitted
        const updatedOrder = await Order.findById(orderId).populate('user', 'email firstName lastName');
        if (updatedOrder) {
          const populatedUser = updatedOrder.user as unknown as { email?: string };
          await eventPublisher.publishOrderSuccessful({
            orderId: updatedOrder._id.toString(),
            userId: typeof updatedOrder.user === 'string' ? updatedOrder.user : updatedOrder.user.toString(),
            orderNumber: updatedOrder._id.toString(),
            totalAmount: updatedOrder.total,
            customerInfo: {
              firstName: updatedOrder.shippingAddress?.firstName || '',
              lastName: updatedOrder.shippingAddress?.lastName || '',
              email: populatedUser.email || '',
            },
            items: updatedOrder.products.map((item) => ({
              productId: item.product?.toString() || '',
              quantity: item.qty || 0,
              price: item.price || 0,
            })),
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
 * Helper function to restore stock for order items
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
  } catch (error) {
    logger.error(`Failed to restore stock for order ${orderId}:`, error);
    throw error;
  }
}

export default router;
