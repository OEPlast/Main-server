import type { PipelineStage } from 'mongoose';
import type { MetricSource } from './metrics';

/**
 * Breakdown dimensions — the "by what" of a metric.
 *
 * A dimension is only valid on sources whose documents actually carry it, so
 * each declares the sources it applies to. Asking for revenue by rating is a
 * category error, and it is better answered with a 400 naming the valid
 * dimensions than with an empty chart.
 */

export interface DimensionDefinition {
  key: string;
  label: string;
  /** Sources this dimension can be applied to. */
  sources: MetricSource[];
  /**
   * Field the grouping key is read from, after `stages` have run.
   *
   * May be an aggregation expression rather than a field path, for dimensions
   * that are derived rather than stored — sentiment is a band over `rating`, not
   * a column anyone writes.
   */
  field: string | Record<string, unknown>;
  /** Fixed display order, for dimensions where sorting by value reads badly. */
  order?: string[];
  /**
   * Resolves grouping keys into human labels.
   *
   * Grouping by product or customer yields ObjectIds, and a chart legend full of
   * `68a1f...` is useless. Applied AFTER `$limit`, so only the rows actually
   * returned are looked up rather than every distinct key in the window.
   */
  labelLookup?: {
    /** Mongo collection name (not the model name). */
    from: string;
    /** Field(s) on the looked-up document to build the label from. */
    fields: string[];
  };
  /**
   * Stages injected between `$match` and `$group` — `$unwind` for array fields,
   * `$lookup` for values that live on a referenced document.
   */
  stages?: PipelineStage[];
  /**
   * Whether the metric's own `valueField` still resolves after `stages`.
   * Unwinding an order's line items changes what "one document" means, so a
   * metric summing `total` would count the order total once per line.
   */
  rescopesValue?: boolean;
}

export const DIMENSIONS: Record<string, DimensionDefinition> = {
  order_status: {
    key: 'order_status',
    label: 'Order status',
    sources: ['orders'],
    field: '$status',
  },

  transaction_status: {
    key: 'transaction_status',
    label: 'Transaction status',
    sources: ['transactions'],
    field: '$status',
  },

  payment_method: {
    key: 'payment_method',
    label: 'Payment method',
    sources: ['transactions'],
    field: '$paymentMethod',
  },

  payment_gateway: {
    key: 'payment_gateway',
    label: 'Payment gateway',
    sources: ['transactions'],
    field: '$paymentGateway',
  },

  rating: {
    key: 'rating',
    label: 'Rating',
    sources: ['reviews'],
    field: '$rating',
    order: ['1', '2', '3', '4', '5'],
  },

  /**
   * Sentiment bands over the star rating.
   *
   * Derived, not stored — the legacy endpoint computed the same three buckets
   * inline with `$cond`. Encoding it here means the definition of "positive" is
   * stated once instead of being reinvented per chart.
   */
  sentiment: {
    key: 'sentiment',
    label: 'Sentiment',
    sources: ['reviews'],
    field: {
      $switch: {
        branches: [
          { case: { $gte: ['$rating', 4] }, then: 'positive' },
          { case: { $lte: ['$rating', 2] }, then: 'negative' },
        ],
        default: 'neutral',
      },
    },
    order: ['positive', 'neutral', 'negative'],
  },

  country: {
    key: 'country',
    label: 'Country',
    sources: ['users'],
    field: '$country',
  },

  coupon_type: {
    key: 'coupon_type',
    label: 'Coupon type',
    sources: ['coupons'],
    field: '$discountType',
  },

  delivery_type: {
    key: 'delivery_type',
    label: 'Delivery type',
    sources: ['orders'],
    field: '$deliveryType',
  },

  coupon_code: {
    key: 'coupon_code',
    label: 'Coupon',
    sources: ['orders'],
    field: '$couponCode',
  },

  shipping_state: {
    key: 'shipping_state',
    label: 'Shipping state',
    sources: ['orders'],
    field: '$shippingAddress.state',
  },

  /**
   * Per-product breakdowns unwind the order's line items, so the natural value
   * becomes line revenue rather than the order total — hence `rescopesValue`.
   */
  product: {
    key: 'product',
    label: 'Product',
    sources: ['orders'],
    field: '$products.product',
    stages: [{ $unwind: '$products' }],
    rescopesValue: true,
    labelLookup: { from: 'products', fields: ['name'] },
  },

  customer: {
    key: 'customer',
    label: 'Customer',
    sources: ['orders'],
    field: '$user',
    labelLookup: { from: 'users', fields: ['firstName', 'lastName'] },
  },

  coupon: {
    key: 'coupon',
    label: 'Coupon',
    sources: ['coupon_redemptions'],
    field: '$coupon',
    // The Coupon model names its code field `coupon`, not `code`.
    labelLookup: { from: 'coupons', fields: ['coupon'] },
  },

  wishlist_product: {
    key: 'wishlist_product',
    label: 'Product',
    sources: ['wishlist'],
    field: '$product',
    labelLookup: { from: 'products', fields: ['name'] },
  },

  review_product: {
    key: 'review_product',
    label: 'Product',
    sources: ['reviews'],
    field: '$product',
    labelLookup: { from: 'products', fields: ['name'] },
  },

  category: {
    key: 'category',
    label: 'Category',
    sources: ['orders'],
    field: '$productDoc.category',
    stages: [
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'productDoc',
          pipeline: [{ $project: { category: 1 } }],
        },
      },
      { $unwind: '$productDoc' },
    ],
    rescopesValue: true,
    labelLookup: { from: 'categories', fields: ['name'] },
  },
};

export const DIMENSION_KEYS = Object.keys(DIMENSIONS);

export const getDimension = (key: string): DimensionDefinition | undefined => DIMENSIONS[key];

/** Dimensions valid for a given source — what `/meta` advertises and validation checks. */
export const dimensionsForSource = (source: MetricSource): DimensionDefinition[] =>
  Object.values(DIMENSIONS).filter((d) => d.sources.includes(source));
