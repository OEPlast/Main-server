import mongoose from 'mongoose';
import type { PipelineStage } from 'mongoose';
import { DEFAULT_TIMEZONE, isValidTimezone } from '@/config/timezone';
import type { CustomResponsePromise } from '@/types';
import Cart from '@/models/Cart';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Review from '@/models/Review';
import Wishlist from '@/models/wishlist';
import { densify } from './buckets';
import type { GranularityRequest, GranularitySpec } from './granularity';
import { GranularityTooFineError, resolveGranularity, truncExpr } from './granularity';
import type { TimeWindow } from './range';
import { RangeError, changePct, comparisonWindow, resolveWindow, spanMs, toZonedIso } from './range';

/** Windowed time helpers are shared with the engine, so a product page buckets identically. */
export interface ProductPerformanceQuery {
  productId: string;
  from?: string;
  to?: string;
  preset?: string;
  granularity?: GranularityRequest;
  tz?: string;
  now?: Date;
}

export interface ProductPerformanceResult {
  product: {
    id: string;
    name: string;
    sku: number | null;
    slug: string | null;
    image: string | null;
    price: number | null;
    stock: number | null;
    lowStockThreshold: number | null;
    createdAt: string | null;
  };
  granularity: string;
  timezone: string;
  from: string;
  to: string;
  totals: {
    revenue: number;
    unitsSold: number;
    ordersContaining: number;
    /** Realised average line price — revenue / units, not the list price. */
    averageSellingPrice: number | null;
    reviews: number;
    averageRating: number | null;
    wishlistAdds: number;
    cartAdds: number;
  };
  comparison: {
    from: string;
    to: string;
    totals: Record<string, number | null>;
    changePct: Record<string, number | null>;
  } | null;
  series: Array<{
    bucket: string;
    bucketLabel: string;
    bucketStart: Date;
    revenue: number;
    unitsSold: number;
  }>;
  /** Star distribution, 1-5, always all five rows so a gap reads as zero. */
  ratings: Array<{ key: string; label: string; value: number; share: number | null }>;
  /** Status of the orders this product appears on. */
  orderStatuses: Array<{ key: string; label: string; value: number; share: number | null }>;
  computedAt: string;
}

class ProductQueryError extends Error {
  constructor(
    message: string,
    public readonly code = 400
  ) {
    super(message);
    this.name = 'ProductQueryError';
  }
}

/**
 * Line-level match for one product inside paid orders.
 *
 * `$unwind` before matching the line, so `products.price`/`products.qty` refer to
 * this product's line and not to whichever line happened to be first.
 */
const paidLineStages = (productId: mongoose.Types.ObjectId, window: TimeWindow): PipelineStage[] => [
  {
    $match: {
      isPaid: true,
      paidAt: { $gte: window.from, $lte: window.to },
      'products.product': productId,
    },
  },
  { $unwind: '$products' },
  { $match: { 'products.product': productId } },
];

/** Line revenue and units — the two figures that must never come from the order total. */
const lineValueExpr = {
  revenue: {
    $sum: { $multiply: ['$products.price', { $ifNull: ['$products.qty', 1] }] },
  },
  unitsSold: { $sum: { $ifNull: ['$products.qty', 1] } },
};

const runTotals = async (productId: mongoose.Types.ObjectId, window: TimeWindow) => {
  const [sales] = await Order.aggregate([
    ...paidLineStages(productId, window),
    {
      $group: {
        _id: null,
        ...lineValueExpr,
        // Counted after the unwind, so an order listing the product on two
        // lines still counts once.
        orders: { $addToSet: '$_id' },
      },
    },
    { $project: { _id: 0, revenue: 1, unitsSold: 1, ordersContaining: { $size: '$orders' } } },
  ]);

  const [reviews] = await Review.aggregate([
    {
      $match: {
        product: productId,
        isApproved: { $ne: false },
        createdAt: { $gte: window.from, $lte: window.to },
      },
    },
    { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } },
  ]);

  const wishlistAdds = await Wishlist.countDocuments({
    product: productId,
    createdAt: { $gte: window.from, $lte: window.to },
  });

  const cartAdds = await Cart.countDocuments({
    'items.product': productId,
    createdAt: { $gte: window.from, $lte: window.to },
  });

  const revenue = sales?.revenue ?? 0;
  const unitsSold = sales?.unitsSold ?? 0;

  return {
    revenue,
    unitsSold,
    ordersContaining: sales?.ordersContaining ?? 0,
    // Null rather than 0 on no sales: "we sold nothing" and "we sold at ₦0" are
    // different statements and only one of them is true.
    averageSellingPrice: unitsSold > 0 ? Number((revenue / unitsSold).toFixed(2)) : null,
    reviews: reviews?.count ?? 0,
    averageRating: reviews?.average != null ? Number(reviews.average.toFixed(2)) : null,
    wishlistAdds,
    cartAdds,
  };
};

const runSeries = async (
  productId: mongoose.Types.ObjectId,
  window: TimeWindow,
  spec: GranularitySpec,
  timezone: string
) => {
  const rows = (await Order.aggregate([
    ...paidLineStages(productId, window),
    {
      $group: {
        _id: truncExpr('paidAt', spec, timezone),
        ...lineValueExpr,
      },
    },
    { $project: { _id: 0, bucketStart: '$_id', revenue: 1, unitsSold: 1 } },
    { $sort: { bucketStart: 1 } },
  ])) as Array<{ bucketStart: Date; revenue: number; unitsSold: number }>;

  // Zero-filled through the whole window: a gap in a sales chart must read as a
  // week with no sales, not as a week the chart forgot to draw.
  const filled = densify(
    rows.map((row) => ({ bucketStart: row.bucketStart, value: row })),
    window,
    spec,
    timezone,
    { revenue: 0, unitsSold: 0 } as { revenue: number; unitsSold: number }
  );

  return filled.map((bucket) => ({
    bucket: bucket.bucket,
    bucketLabel: bucket.bucketLabel,
    bucketStart: bucket.bucketStart,
    revenue: bucket.value?.revenue ?? 0,
    unitsSold: bucket.value?.unitsSold ?? 0,
  }));
};

const withShare = <T extends { value: number }>(rows: T[]): Array<T & { share: number | null }> => {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({
    ...row,
    share: total ? Number(((row.value / total) * 100).toFixed(2)) : null,
  }));
};

const runRatings = async (productId: mongoose.Types.ObjectId, window: TimeWindow) => {
  const rows = (await Review.aggregate([
    {
      $match: {
        product: productId,
        isApproved: { $ne: false },
        createdAt: { $gte: window.from, $lte: window.to },
      },
    },
    { $group: { _id: '$rating', value: { $sum: 1 } } },
  ])) as Array<{ _id: number; value: number }>;

  const byRating = new Map(rows.map((row) => [Number(row._id), row.value]));

  // All five rows always, in descending order: a distribution missing its empty
  // bands invites the reader to assume they were never possible.
  return withShare(
    [5, 4, 3, 2, 1].map((star) => ({
      key: String(star),
      label: `${star} star${star === 1 ? '' : 's'}`,
      value: byRating.get(star) ?? 0,
    }))
  );
};

const runOrderStatuses = async (productId: mongoose.Types.ObjectId, window: TimeWindow) => {
  // On createdAt, not paidAt: an unpaid or cancelled order has no paidAt, and
  // those are exactly the statuses this breakdown exists to show.
  const rows = (await Order.aggregate([
    {
      $match: {
        'products.product': productId,
        createdAt: { $gte: window.from, $lte: window.to },
      },
    },
    { $group: { _id: '$status', value: { $sum: 1 } } },
    { $sort: { value: -1 } },
  ])) as Array<{ _id: string; value: number }>;

  return withShare(
    rows.map((row) => ({
      key: String(row._id ?? 'unknown'),
      label: String(row._id ?? 'Unknown'),
      value: row.value,
    }))
  );
};

export const runProductPerformance = async (
  query: ProductPerformanceQuery
): CustomResponsePromise<ProductPerformanceResult> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(query.productId)) {
      throw new ProductQueryError(`"${query.productId}" is not a valid product id.`);
    }

    const timezone = query.tz ?? DEFAULT_TIMEZONE;
    if (!isValidTimezone(timezone)) {
      throw new ProductQueryError(`"${timezone}" is not a valid IANA timezone.`);
    }

    const productId = new mongoose.Types.ObjectId(query.productId);

    const product = await Product.findById(productId)
      .select('name sku slug price stock lowStockThreshold description_images createdAt')
      .lean()
      .exec();

    if (!product) {
      throw new ProductQueryError('Product not found.', 404);
    }

    const window = resolveWindow({
      preset: query.preset,
      from: query.from,
      to: query.to,
      timezone,
      now: query.now,
    });

    const { spec } = resolveGranularity(spanMs(window), query.granularity ?? 'auto');

    const [totals, series, ratings, orderStatuses] = await Promise.all([
      runTotals(productId, window),
      runSeries(productId, window, spec, timezone),
      runRatings(productId, window),
      runOrderStatuses(productId, window),
    ]);

    // Previous period for the headline figures only. Ratings and statuses are
    // distributions; a "% change" on a distribution is not a meaningful number.
    const previous = comparisonWindow(window, 'previous', spec, timezone);
    const previousTotals = previous ? await runTotals(productId, previous) : null;

    const comparable = ['revenue', 'unitsSold', 'ordersContaining', 'reviews'] as const;

    const images = (product as { description_images?: Array<{ url?: string; cover_image?: boolean }> })
      .description_images;

    return {
      message: 'Product performance fetched successfully',
      data: {
        product: {
          id: String(product._id),
          name: product.name,
          sku: product.sku ?? null,
          slug: (product as { slug?: string }).slug ?? null,
          image: images?.find((img) => img.cover_image)?.url ?? images?.[0]?.url ?? null,
          price: product.price ?? null,
          stock: (product as { stock?: number }).stock ?? null,
          lowStockThreshold: (product as { lowStockThreshold?: number }).lowStockThreshold ?? null,
          createdAt: (product as { createdAt?: Date }).createdAt
            ? new Date((product as { createdAt: Date }).createdAt).toISOString()
            : null,
        },
        granularity: spec.granularity,
        timezone,
        from: toZonedIso(window.from, timezone),
        to: toZonedIso(window.to, timezone),
        totals,
        comparison:
          previous && previousTotals
            ? {
                from: toZonedIso(previous.from, timezone),
                to: toZonedIso(previous.to, timezone),
                totals: Object.fromEntries(comparable.map((key) => [key, previousTotals[key]])),
                changePct: Object.fromEntries(
                  comparable.map((key) => [key, changePct(Number(totals[key] ?? 0), Number(previousTotals[key] ?? 0))])
                ),
              }
            : null,
        series,
        ratings,
        orderStatuses,
        computedAt: new Date().toISOString(),
      },
      code: 200,
    };
  } catch (error) {
    if (error instanceof ProductQueryError) {
      return { message: error.message, data: null, code: error.code };
    }
    if (error instanceof RangeError || error instanceof GranularityTooFineError) {
      return { message: error.message, data: null, code: 400 };
    }
    console.error('Error in runProductPerformance:', error);
    return { message: 'Product performance query failed', data: null, code: 500 };
  }
};
