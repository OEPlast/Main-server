/**
 * Prices a list of cart lines from the database: loads each product and its active sale (one sale
 * per product, `Sales.product` is unique) and runs `priceLine`. The sale is always found by the
 * product, never taken from the client, so a request can't attach another product's sale.
 *
 * Pass the transaction `session` when pricing inside order creation, so sale counters read here are
 * the ones the same transaction increments.
 */
import mongoose, { ClientSession } from 'mongoose';
import Product from '@/models/Product';
import Sales from '@/models/Sales';
import { priceLine, roundKobo, type LinePrice, type PricingProduct, type PricingSale, type SelectedAttribute } from './linePricing';
import type { CouponLine } from './couponPricing';

export interface CartLineInput {
  product: string | mongoose.Types.ObjectId;
  qty: number;
  selectedAttributes?: SelectedAttribute[] | null;
}

export interface PricedCartLine extends LinePrice {
  productId: string;
  categoryId: string | null;
  name: string;
  selectedAttributes: SelectedAttribute[];
}

export interface PricedCart {
  lines: PricedCartLine[];
  /** Product ids that no longer exist. Their lines are left out of `lines`. */
  missingProductIds: string[];
  /** After tiers and sales, before coupons and delivery. */
  itemsSubtotal: number;
  /** List prices × qty, before any discount. */
  listSubtotal: number;
  tierDiscountTotal: number;
  saleDiscountTotal: number;
}

type ProductLean = PricingProduct & { _id: mongoose.Types.ObjectId; name?: string; category?: unknown };

export async function priceCart(
  items: CartLineInput[],
  options: { session?: ClientSession; now?: Date } = {}
): Promise<PricedCart> {
  const ids = [...new Set(items.map((item) => String(item.product)))].filter((id) => mongoose.isValidObjectId(id));

  const productQuery = Product.find({ _id: { $in: ids } }).select('name price pricingTiers attributes category');
  const saleQuery = Sales.find({ product: { $in: ids }, isActive: true, deleted: { $ne: true } });
  if (options.session) {
    productQuery.session(options.session);
    saleQuery.session(options.session);
  }
  const [products, sales] = await Promise.all([productQuery.lean<ProductLean[]>(), saleQuery.lean<Array<PricingSale & { product: unknown }>>()]);

  const productById = new Map(products.map((p) => [String(p._id), p]));
  const saleByProduct = new Map(sales.map((s) => [String(s.product), s]));
  const now = options.now ?? new Date();

  const lines: PricedCartLine[] = [];
  const missingProductIds: string[] = [];

  for (const item of items) {
    const productId = String(item.product);
    const product = productById.get(productId);
    if (!product) {
      missingProductIds.push(productId);
      continue;
    }
    const selectedAttributes = (item.selectedAttributes ?? []).map((a) => ({ name: a.name, value: a.value }));
    const priced = priceLine({
      product,
      qty: Number(item.qty),
      selectedAttributes,
      sale: saleByProduct.get(productId) ?? null,
      now,
    });
    const category = product.category as { _id?: unknown } | string | null | undefined;
    lines.push({
      ...priced,
      productId,
      categoryId: category ? String(typeof category === 'object' && '_id' in category ? category._id : category) : null,
      name: product.name ?? 'Product',
      selectedAttributes,
    });
  }

  const sum = (pick: (line: PricedCartLine) => number) => roundKobo(lines.reduce((total, line) => total + pick(line), 0));

  return {
    lines,
    missingProductIds,
    itemsSubtotal: sum((line) => line.lineTotal),
    listSubtotal: sum((line) => line.listUnitPrice * line.qty),
    tierDiscountTotal: sum((line) => line.tierDiscountTotal),
    saleDiscountTotal: sum((line) => line.saleDiscountTotal),
  };
}

export const toCouponLines = (lines: PricedCartLine[]): CouponLine[] =>
  lines.map((line) => ({ productId: line.productId, categoryId: line.categoryId, lineTotal: line.lineTotal }));
