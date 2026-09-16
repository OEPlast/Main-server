// Must stay the first two imports: dotenv so every module that reads process.env at load time
// sees the file, and the env check so a missing secret stops the process with a clear list.
import 'dotenv/config';
import '@/lib/env';
import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { morganAccessLog, morganMiddleware } from './middleware/morgan';
import connectDB from './lib/db';

import ProductsRoute from '@/routes/general/products';
import ReviewRoute from './routes/general/review';
import CategoriesRoute from '@/routes/general/categories';
import TransactionRoute from '@/routes/general/transaction';
import SitemapRoute from '@/routes/general/sitemap';
import IntentsRoute from '@/routes/general/intents';
import FeedRoute from '@/routes/general/feed';
import MerchantRoute from '@/routes/general/merchant';
import AuthRoute from '@/routes/auth/user';
import OrderRoute from '@/routes/users/orders';
import CartRoute from '@/routes/users/cart';
import BannersRoute from '@/routes/general/banners';
import UserBannersRoute from '@/routes/user/banners';
import WishlistRoute from '@/routes/users/wishlist';
import CheckoutRoute from '@/routes/users/checkout';
import UserReviewsRoute from '@/routes/users/reviews';
import UserRoute from '@/routes/users/user';
import InventoryRoute from '@/routes/general/inventory';
import LogisticsPublicRoute from '@/routes/general/logistics';
import UserShipmentsRoute from '@/routes/users/shipments';
import UserCampaignsRoute from '@/routes/users/campaigns';
import UserReturnsRoute from '@/routes/users/returns';
import CouponsRoute from '@/routes/general/coupons';
import SettingsRoute from '@/routes/general/settings';
import UnsubscribeRoute from '@/routes/general/unsubscribe';
import NewsletterRoute from '@/routes/general/newsletter';
import OrderLookupRoute from '@/routes/general/orderLookup';
import EmailPreferencesRoute from '@/routes/users/emailPreferences';
import AccountRoute from '@/routes/users/account';
import GIGPublicRoute from '@/routes/general/gig';
import { eventPublisher } from '@/events';

import {
  AdminAttributeRoute,
  AdminBannerRoute,
  AdminCategoryRoute,
  AdminOrderRoute,
  AdminProductRoute,
  AdminUsersRoute,
  AdminAnalyticsRoute,
  AdminCouponRoute,
  AdminShipmentRoute,
  AdminRolesRoute,
  AdminCampaignRoute,
  AdminIntentRoute,
  AdminSalesRoute,
  AdminInventoryRoute,
  AdminLogisticsRoute,
  AdminTransactionRoute,
  AdminReturnRoute,
  AdminReviewRoute,
  AdminDeliveryRoute,
  AdminGIGRoute,
} from './routes/admin';
import FileUploadRoute from '@/routes/general/fileUpload';
import EmailProcessor from './services/processor/EmailProcessor';
import InternalServiceRoutes from '@/routes/internal/serviceRoutes';
import AdminAuditLogRoute from '@/routes/admin/auditLog';
import AdminNotificationsRoute from '@/routes/admin/notifications';
import { auditAdminMutations } from '@/middleware/audit';
import { logger } from '@/lib/logger';
import cron from 'node-cron';
import { startGIGTrackingSync } from '@/cron/gigTrackingSync';
import { startMerchantSync } from '@/cron/merchantSync';
import { startPaymentReconciliation } from '@/cron/paymentReconciliation';
import { startReviewRequests } from '@/cron/reviewRequests';
import { startAccountDeletions } from '@/cron/accountDeletion';

// Helper to capture raw body without using any
const rawBodySaver = (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
  req.rawBody = buf;
};

const app: Application = express();
// Express Middlewares

// Rate limits key on req.ip. Behind a load balancer or reverse proxy every request arrives from
// the proxy's address, so all customers would share one limit. TRUST_PROXY is the number of
// proxy hops in front of this server (usually 1). Leave it unset when clients connect directly:
// trusting X-Forwarded-For without a proxy lets anyone spoof their IP past the limits.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

// CORS configuration from environment variable
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:3009', 'http://localhost:4999']; //  fallback

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  })
);

app.use(helmet());
app.use(express.urlencoded({ limit: '25mb', extended: true }));
// capture raw body for HMAC verification (e.g., Paystack)
app.use(
  express.json({
    verify: rawBodySaver as unknown as (req: Request, res: Response, buf: Buffer, encoding: string) => void,
    limit: '25mb',
  })
);
app.use(morganMiddleware);
app.use(morganAccessLog);

// Connect RabbitMQ publisher (non-blocking)
(async () => {
  try {
    await eventPublisher.connect();
  } catch (err) {
    console.error('EventPublisher failed to connect:', err);
  }
})();

// Internal Service Routes (MUST be registered BEFORE other routes for priority)
app.use('/api/internal', InternalServiceRoutes);

// Root Route
app.use('/auth', AuthRoute);
// Before /user so its router-level authenticateUser does not shadow the preference routes' own.
app.use('/user/email-preferences', EmailPreferencesRoute);
app.use('/user/account', AccountRoute);
app.use('/user', UserRoute);
app.use('/banners', UserBannersRoute);
app.use('/files', FileUploadRoute);
app.use('/categories', CategoriesRoute);
app.use('/banners', BannersRoute);
app.use('/products', ProductsRoute);
app.use('/logistics', LogisticsPublicRoute);
app.use('/wishlist', WishlistRoute);
app.use('/campaigns', UserCampaignsRoute);
app.use('/cart', CartRoute);
app.use('/checkout', CheckoutRoute);
app.use('/myorder', OrderRoute);
app.use('/payments', TransactionRoute);
app.use('/reviews/user', UserReviewsRoute);
app.use('/reviews', ReviewRoute);
app.use('/returns', UserReturnsRoute);
app.use('/coupons', CouponsRoute);
app.use('/settings', SettingsRoute);
// Public, unauthenticated: reached from a link in an email footer.
app.use('/unsubscribe', UnsubscribeRoute);
app.use('/newsletter', NewsletterRoute);
app.use('/orders', OrderLookupRoute);
app.use('/gig', GIGPublicRoute);
app.use('/sitemap', SitemapRoute);
app.use('/intents', IntentsRoute);
app.use('/feed', FeedRoute);
app.use('/merchant', MerchantRoute);

app.use('/users', UserShipmentsRoute);
app.use('/inventory', InventoryRoute);

//------------------
//admin
// Every successful POST/PUT/PATCH/DELETE under /admin is recorded with who did it.
app.use('/admin', auditAdminMutations);
app.use('/admin/audit-log', AdminAuditLogRoute);
app.use('/admin/notifications', AdminNotificationsRoute);
app.use('/admin/roles', AdminRolesRoute);
app.use('/admin/coupon', AdminCouponRoute);
app.use('/admin/attributes', AdminAttributeRoute);
app.use('/admin/category', AdminCategoryRoute);
app.use('/admin/users', AdminUsersRoute);
app.use('/admin/banners', AdminBannerRoute);
app.use('/admin/products', AdminProductRoute);
app.use('/admin/logistics', AdminLogisticsRoute);
app.use('/admin/sales', AdminSalesRoute);
app.use('/admin/campaigns', AdminCampaignRoute);
app.use('/admin/intents', AdminIntentRoute);
app.use('/admin/orders', AdminOrderRoute);
app.use('/admin/inventory', AdminInventoryRoute);
app.use('/admin/transactions', AdminTransactionRoute);
app.use('/admin/reviews', AdminReviewRoute);
app.use('/admin/returns', AdminReturnRoute);

app.use('/admin/shipment', AdminShipmentRoute);
app.use('/admin/delivery', AdminDeliveryRoute);
app.use('/admin/gig', AdminGIGRoute);

app.use('/admin/analytics', AdminAnalyticsRoute);

//------------------
// server Health Check
app.get('/health', (_req: Request, res: Response) => {
  const dbConnected = mongoose.connection.readyState === 1;
  // RabbitMQ is connected non-blockingly at startup (see the IIFE above) and Main-server
  // still functions with it down — publishes just get dropped — so it's reported but doesn't
  // flip overall status, unlike the DB which everything here depends on.
  const rabbitmqConnected = eventPublisher.isRabbitMQConnected();

  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'healthy' : 'unhealthy',
    service: 'main-server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      database: dbConnected ? 'connected' : 'disconnected',
      rabbitmq: rabbitmqConnected ? 'connected' : 'disconnected',
      pendingEvents: eventPublisher.pendingCount(),
    },
  });
});

// Anything not matched above. Without this Express answered unknown routes with an HTML page.
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}`, data: null, code: 404 });
});

/**
 * Last-resort error handler. Express had none, so a thrown error in a route produced its default
 * HTML stack trace page, and a malformed JSON body a 500. Body-parser problems become 400s;
 * everything else is logged with the request id and answered with a generic 500.
 */
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const error = err as { status?: number; statusCode?: number; type?: string; message?: string };
  const status = error.status ?? error.statusCode ?? 500;
  if (status >= 400 && status < 500) {
    const message =
      error.type === 'entity.parse.failed' ? 'Malformed JSON body' : error.message || 'Bad request';
    return res.status(status).json({ message, data: null, code: status });
  }
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl} (request ${req.get('x-request-id') ?? '-'})`, err);
  return res.status(500).json({ message: 'Something went wrong', data: null, code: 500 });
});

// Start the server — DB and dependent services must be ready before we accept traffic.
const port = process.env.PORT || 4000;

let server: ReturnType<typeof app.listen> | null = null;
let shuttingDown = false;

/**
 * Orderly stop on SIGTERM/SIGINT: stop taking requests, let in-flight ones finish, stop the cron
 * jobs, drain queued events, close the database. A deploy used to kill the process mid-checkout.
 * Anything still hanging after 15 seconds is abandoned so the host is never left waiting.
 */
async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Shutting down (${reason})`);

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out; exiting');
    process.exit(exitCode || 1);
  }, 15_000);
  forceExit.unref();

  try {
    for (const task of cron.getTasks().values()) task.stop();
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await eventPublisher.disconnect();
    await mongoose.connection.close();
    logger.info('Shutdown complete');
  } catch (error) {
    logger.error('Error during shutdown', error);
    exitCode = exitCode || 1;
  } finally {
    clearTimeout(forceExit);
    process.exit(exitCode);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`, error);
  void shutdown('uncaught exception', 1);
});

async function startServer() {
  try {
    await connectDB();
    await EmailProcessor.initialize();
    startGIGTrackingSync();
    startMerchantSync();
    startPaymentReconciliation();
    startReviewRequests();
    startAccountDeletions();
    server = app.listen(port, () => {
      logger.info(`Server is listening on port ${port}`);
    });
  } catch (error) {
    logger.error('Failed to start', error);
    process.exit(1);
  }
}

startServer();
