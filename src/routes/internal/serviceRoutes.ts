import { Router, Request, Response } from 'express';
import Order from '@/models/Order';
import Transaction from '@/models/Transaction';
import Product from '@/models/Product';
import { verifyInternalService } from '@/middleware/auth';
import { logger } from '@/lib/logger';
import eventPublisher from '@/events/eventPublisher';
import TransactionService from '@/services/TransactionService';
import { reverseSaleCountersOnCancel } from '@/helpers/saleOrderUtils';
import { loadOrderEmailContext, toOrderConfirmation } from '@/services/email/orderEmailPayload';
import { getBrand } from '@/services/email/brand';
import { isMarketingAllowed } from '@/services/email/consent';
import { signUnsubscribeToken } from '@/utils/unsubscribeToken';
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

        // Ensure ORDER_SUCCESSFUL is emitted with complete data.
        //
        // This branch used to hold its own copy of the payload builder, and it was the most
        // broken of the three: it read `description_images[0]` as a string (the schema stores
        // objects, so no product image ever resolved), omitted gigWaybill, the delivery
        // estimate and every pickup field, and dereferenced `shipmentId._id` unguarded —
        // which throws on pickup orders, where `shipmentId` is null.
        const orderEmailContext = await loadOrderEmailContext(orderId);
        if (orderEmailContext) {
          await eventPublisher.publishOrderSuccessful(toOrderConfirmation(orderEmailContext));
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

/**
 * GET /api/internal/branding
 *
 * Store branding for services that send email but have no database connection.
 *
 * event-bus owns the entire order lifecycle mail — confirmation, shipped, delivered — and
 * had no way to read the `Settings` document, so it rendered every one of those emails with
 * no logo, no store name in the sender, no support address and no postal address, while
 * Main-server's copies of the same templates had all of it.
 */
router.get('/branding', async (_req: Request, res: Response) => {
  try {
    const brand = await getBrand();
    return res.status(200).json({ data: brand });
  } catch (error) {
    logger.error('Failed to resolve branding for internal consumer:', error);
    return res.status(500).json({ error: 'Failed to resolve branding' });
  }
});

/**
 * GET /api/internal/email/marketing-consent?email=…
 *
 * Whether an address may be sent marketing email, plus its signed unsubscribe token.
 *
 * event-bus sends the post-delivery review request but has no database, so it cannot check
 * an opt-out or sign a link itself. Both come from here in one call.
 */
router.get('/email/marketing-consent', async (req: Request, res: Response) => {
  const email = String(req.query.email ?? '');
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    return res.status(200).json({
      data: {
        allowed: await isMarketingAllowed(email),
        unsubscribeToken: signUnsubscribeToken(email),
      },
    });
  } catch (error) {
    logger.error(`Failed to resolve marketing consent for ${email}:`, error);
    return res.status(500).json({ error: 'Failed to resolve marketing consent' });
  }
});

export default router;
