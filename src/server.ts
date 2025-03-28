import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config as envConfig } from 'dotenv';
import { morganMiddleware } from './middleware/morgan';
import ProductsRoute from '@/routes/general/products';
import connectDB from './lib/db';
import ReviewRoute from './routes/general/review';
import AuthRoute from '@/routes/auth/user';
import OrderRoute from '@/routes/users/orders';

import WishlistRoute from '@/routes/users/wishlist';
import {
  AdminAttributeRoute,
  AdminCategoryRoute,
  AdminGalleryRoute,
  AdminOrderRoute,
  AdminProductRoute,
  AdminRoleRoute,
} from './routes/admin';
const app: Application = express();
// Express Middlewares
envConfig();
app.use(helmet());
app.use(cors());
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(express.json());
app.use(morganMiddleware);

// Root Route
app.use('/products', ProductsRoute);
app.use('/reviews', ReviewRoute);
app.use('/auth', AuthRoute);
app.use('/wishlist', WishlistRoute);
app.use('/orders', OrderRoute);
//------------------
//admin
app.use('/admin/product', AdminProductRoute);
app.use('/admin/gallery', AdminGalleryRoute);
app.use('/admin/roles', AdminRoleRoute);
app.use('/admin/attributes', AdminAttributeRoute);
app.use('/admin/category', AdminCategoryRoute);
app.use('/admin/orders', AdminOrderRoute);

//------------------
// server Health Check
app.get('/health-check', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Server is up and running!' });
});

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  try {
    connectDB();
    console.log(`Server is listening on port ${port}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
});
