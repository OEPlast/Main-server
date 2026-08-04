import type { Model } from 'mongoose';
import Cart from '@/models/Cart';
import Coupon from '@/models/Coupon';
import CouponRedemption from '@/models/CouponRedemption';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Review from '@/models/Review';
import Shipment from '@/models/Shipment';
import Transaction from '@/models/Transaction';
import User from '@/models/User';
import Wishlist from '@/models/wishlist';
import type { MetricSource } from './metrics';

/**
 * Which collection each metric source reads from.
 *
 * Kept out of `metrics.ts` on purpose. The registry is imported by the `/meta`
 * endpoint, by validators and by unit tests that have no database; pulling nine
 * Mongoose models in alongside it would make the registry impossible to import
 * cheaply. This module is the only place the two halves meet.
 */
export const SOURCE_MODELS: Record<MetricSource, Model<any>> = {
  orders: Order as unknown as Model<any>,
  transactions: Transaction as unknown as Model<any>,
  users: User as unknown as Model<any>,
  reviews: Review as unknown as Model<any>,
  products: Product as unknown as Model<any>,
  shipments: Shipment as unknown as Model<any>,
  carts: Cart as unknown as Model<any>,
  wishlist: Wishlist as unknown as Model<any>,
  coupons: Coupon as unknown as Model<any>,
  coupon_redemptions: CouponRedemption as unknown as Model<any>,
};

export const getSourceModel = (source: MetricSource): Model<any> => {
  const model = SOURCE_MODELS[source];

  if (!model) {
    // Only reachable if MetricSource gains a member without a model mapping —
    // a loud failure beats a metric that silently aggregates nothing.
    throw new Error(`No model registered for metric source "${source}"`);
  }

  return model;
};
