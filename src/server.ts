import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config as envConfig } from 'dotenv';
import { morganMiddleware } from './middleware/morgan';
import connectDB from './lib/db';

import ProductsRoute from '@/routes/general/products';
import ReviewRoute from './routes/general/review';
import CategoriesRoute from '@/routes/general/categories';
import PaymentRoute from '@/routes/general/payment';
import AuthRoute from '@/routes/auth/user';
import OrderRoute from '@/routes/users/orders';
import CartRoute from '@/routes/users/cart';
import BannersRoute from '@/routes/general/banners';
import WishlistRoute from '@/routes/users/wishlist';
import CheckoutRoute from '@/routes/users/checkout';
import UserReviewsRoute from '@/routes/users/reviews';
import UserRoute from '@/routes/users/user';
import InventoryRoute from '@/routes/general/inventory';
import LogisticsPublicRoute from '@/routes/general/logistics';
import UserShipmentsRoute from '@/routes/users/shipments';
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
  AdminSalesRoute,
  AdminInventoryRoute,
  AdminInvoicesRoute,
  AdminCouponAnalyticsRoute,
  AdminLogisticsRoute,
} from './routes/admin';
import FileUploadRoute from '@/routes/general/fileUpload';
import EmailProcessor from './services/EmailProcessor';

// Helper to capture raw body without using any
const rawBodySaver = (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
  req.rawBody = buf;
};

const app: Application = express();
// Express Middlewares
envConfig();
app.use(helmet());
app.use(cors());
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

// Root Route
app.use('/auth', AuthRoute);
app.use('/user', UserRoute);
app.use('/files', FileUploadRoute);
app.use('/categories', CategoriesRoute);
app.use('/banners', BannersRoute);
app.use('/products', ProductsRoute);
app.use('/logistics', LogisticsPublicRoute);

app.use('/wishlist', WishlistRoute);
app.use('/reviews/user', UserReviewsRoute);
app.use('/reviews', ReviewRoute);
app.use('/carts', CartRoute);

app.use('/payments', PaymentRoute);
app.use('/orders', OrderRoute);
app.use('/checkout', CheckoutRoute);
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
app.use('/admin/product', AdminProductRoute);
app.use('/admin/logistics', AdminLogisticsRoute);

app.use('/reviews', ReviewRoute);
app.use('/admin/campaigns', AdminCampaignRoute);
app.use('/admin/invoices', AdminInvoicesRoute);
app.use('/admin/sales', AdminSalesRoute);

app.use('/admin/orders', AdminOrderRoute);
app.use('/admin/shipment', AdminShipmentRoute);
app.use('/admin/inventory', AdminInventoryRoute);
app.use('/admin/coupon-analytics', AdminCouponAnalyticsRoute);
app.use('/admin/analytics', AdminAnalyticsRoute);

//------------------
// server Health Check
app.get('/health-check', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Server is up and running!' });
});

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, async () => {
  try {
    await connectDB();
    await EmailProcessor.initialize();
    console.log(`Server is listening on port ${port}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
});
