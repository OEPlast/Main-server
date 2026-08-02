import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config as envConfig } from 'dotenv';
import { morganMiddleware } from './middleware/morgan';
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
  AdminCouponAnalyticsRoute,
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
import { startGIGTrackingSync } from '@/cron/gigTrackingSync';
import { startMerchantSync } from '@/cron/merchantSync';

// Helper to capture raw body without using any
const rawBodySaver = (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
  req.rawBody = buf;
};

const app: Application = express();
// Express Middlewares
envConfig();

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
app.use('/gig', GIGPublicRoute);
app.use('/sitemap', SitemapRoute);
app.use('/intents', IntentsRoute);
app.use('/feed', FeedRoute);
app.use('/merchant', MerchantRoute);

app.use('/users', UserShipmentsRoute);
app.use('/inventory', InventoryRoute);

//------------------
//admin
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
app.use('/admin/coupon-analytics', AdminCouponAnalyticsRoute);
app.use('/admin/transactions', AdminTransactionRoute);
app.use('/admin/reviews', AdminReviewRoute);
app.use('/admin/returns', AdminReturnRoute);

app.use('/admin/shipment', AdminShipmentRoute);
app.use('/admin/delivery', AdminDeliveryRoute);
app.use('/admin/gig', AdminGIGRoute);

app.use('/admin/analytics', AdminAnalyticsRoute);

//------------------
// server Health Check
app.get('/health-check', (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Server is up and running!' });
});

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, async () => {
  try {
    await connectDB();
    await EmailProcessor.initialize();
    startGIGTrackingSync();
    startMerchantSync();
    console.log(`Server is listening on port ${port}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
});
