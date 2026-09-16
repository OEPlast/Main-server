import cron from 'node-cron';
import Order from '@/models/Order';
import Review from '@/models/Review';
import EmailProcessor from '@/services/processor/EmailProcessor';
import { loadOrderEmailContext } from '@/services/email/orderEmailPayload';
import { logger } from '@/lib/logger';

/** How long after delivery to ask for a review (default 3 days). */
const ratingRequestDelayMs = (): number => {
  const configured = Number(process.env.RATING_REQUEST_DELAY);
  return Number.isFinite(configured) && configured > 0 ? configured : 3 * 24 * 60 * 60 * 1000;
};

/** Deliveries older than this are left alone: a nudge a month later reads as spam. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;
let running = false;

/**
 * Sends the post-delivery review request.
 *
 * This lived in event-bus as a `setTimeout` armed when the delivered event arrived: lost on every
 * restart, duplicated on every redelivery, and blind to reviews the customer had already left. It
 * now runs from `deliveredAt` in the database, marks the order once it has sent (or decided not
 * to), and skips products the customer has reviewed. Marketing consent is checked by the mailer.
 */
async function runReviewRequests(): Promise<void> {
  if (running) return;
  running = true;
  let sent = 0;
  let skipped = 0;

  try {
    const now = Date.now();
    const orders = await Order.find({
      status: 'Completed',
      reviewRequestSentAt: { $exists: false },
      deliveredAt: { $lte: new Date(now - ratingRequestDelayMs()), $gte: new Date(now - MAX_AGE_MS) },
    })
      .sort({ deliveredAt: 1 })
      .limit(BATCH_SIZE)
      .select('_id user products.product deliveredAt')
      .populate('products.product', 'slug')
      .lean();

    for (const order of orders) {
      // Claim first, so two instances never both send.
      const claimed = await Order.updateOne(
        { _id: order._id, reviewRequestSentAt: { $exists: false } },
        { $set: { reviewRequestSentAt: new Date() } }
      );
      if (claimed.modifiedCount === 0) continue;

      try {
        const productIds = order.products.map((line) => (line.product as { _id?: unknown })?._id).filter(Boolean);
        const reviewed = await Review.find({ reviewBy: order.user, product: { $in: productIds } })
          .select('product')
          .lean();
        const reviewedIds = new Set(reviewed.map((r) => String(r.product)));
        const reviewedSlugs = new Set(
          order.products
            .filter((line) => reviewedIds.has(String((line.product as { _id?: unknown })?._id)))
            .map((line) => (line.product as { slug?: string })?.slug)
        );

        const context = await loadOrderEmailContext(order._id.toString());
        const products = (context?.products ?? []).filter((p) => p.reviewLink && !reviewedSlugs.has(p.slug));
        if (!context || products.length === 0) {
          skipped += 1;
          continue;
        }

        await EmailProcessor.send('rating', {
          email: context.email,
          firstName: context.firstName,
          lastName: context.lastName,
          orderId: context.orderId,
          orderNumber: context.orderNumber,
          purchaseDate: order.deliveredAt ?? context.purchaseDate,
          products,
          viewOrderLink: context.links.order,
        });
        sent += 1;
      } catch (error) {
        logger.error(`[review-requests] failed for order ${order._id.toString()}:`, error);
      }
    }

    if (orders.length > 0) logger.info(`[review-requests] ${orders.length} due: ${sent} sent, ${skipped} skipped`);
  } catch (error) {
    logger.error('[review-requests] run failed:', error);
  } finally {
    running = false;
  }
}

export function startReviewRequests(): void {
  cron.schedule('15 * * * *', () => {
    void runReviewRequests();
  });
  logger.info(`[review-requests] Started: ${Math.round(ratingRequestDelayMs() / 3_600_000)}h after delivery`);
}
