import mongoose, { Types } from 'mongoose';
import StockAlert from '@/models/StockAlert';
import Product from '@/models/Product';
import EmailProcessor from '@/services/processor/EmailProcessor';
import { getBrand } from '@/services/brand';
import { productUrl } from '@/services/brand/links';
import { logger } from '@/lib/logger';
import { CustomResponseType } from '@/types';

/**
 * "Email me when it's back": customers ask on an out-of-stock product (optionally for one option,
 * e.g. Ring Size 7) and get one email when stock returns. `checkRestocked` is called wherever
 * stock goes up; with no waiting alerts it costs one indexed count.
 */

type AlertProduct = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  price: number;
  stock: number;
  status?: string;
  description_images?: Array<{ url?: string; cover_image?: boolean; mediaType?: string }>;
  attributes?: Array<{ name: string; children: Array<{ name: string; stock: number }> }>;
  variants?: Array<{ options: Array<{ name: string; value: string }>; stock: number }>;
};

const optionStock = (product: AlertProduct, attribute?: { name: string; value: string } | null) => {
  if (!attribute) return product.stock;
  // With combinations, an option is back when any combination that includes it is.
  if (product.variants?.length) {
    return product.variants
      .filter((v) => v.options.some((o) => o.name === attribute.name && o.value === attribute.value))
      .reduce((sum, v) => sum + v.stock, 0);
  }
  const child = product.attributes?.find((a) => a.name === attribute.name)?.children.find((c) => c.name === attribute.value);
  // Products without per-option stock fall back to the product total.
  return child ? Math.min(child.stock, product.stock) : product.stock;
};

const createAlert = async (
  productId: string,
  input: { email: string; attribute?: { name: string; value: string } },
  userId?: string
): Promise<CustomResponseType<{ ok: true }>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) return { message: 'Product not found', data: null, code: 404 };
    const product = await Product.findById(productId).select('status attributes.name attributes.children.name').lean();
    if (!product || product.status !== 'active') return { message: 'Product not found', data: null, code: 404 };
    if (input.attribute) {
      const exists = product.attributes?.some(
        (a) => a.name === input.attribute!.name && a.children.some((c) => c.name === input.attribute!.value)
      );
      if (!exists) return { message: `${input.attribute.name} ${input.attribute.value} is not an option of this product`, data: null, code: 400 };
    }
    try {
      await StockAlert.create({
        product: productId,
        email: input.email,
        attribute: input.attribute,
        user: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : undefined,
      });
    } catch (error) {
      // Already waiting for this product/option: asking again is fine.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    return { message: "We'll email you when it's back in stock", data: { ok: true }, code: 201 };
  } catch (error) {
    console.error('Error creating stock alert:', error);
    return { message: 'Could not save your alert', data: null, code: 500 };
  }
};

/** Emails everyone waiting on these products whose product/option is in stock again. */
async function checkRestocked(productIds: Array<string | Types.ObjectId>): Promise<number> {
  const ids = [...new Set(productIds.map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return 0;
  const waiting = await StockAlert.find({ product: { $in: ids }, pending: true }).lean();
  if (!waiting.length) return 0;

  const products = await Product.find({ _id: { $in: [...new Set(waiting.map((a) => String(a.product)))] } })
    .select('name slug price stock status description_images attributes.name attributes.children.name attributes.children.stock variants.options variants.stock')
    .lean<AlertProduct[]>();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const brand = await getBrand();

  let sent = 0;
  for (const alert of waiting) {
    const product = byId.get(String(alert.product));
    if (!product || product.status !== 'active' || optionStock(product, alert.attribute) <= 0) continue;
    // Claim it first so two concurrent restocks don't both email.
    const claimed = await StockAlert.findOneAndUpdate(
      { _id: alert._id, pending: true },
      { $set: { notifiedAt: new Date() }, $unset: { pending: 1 } }
    );
    if (!claimed) continue;
    const image =
      product.description_images?.find((i) => i.cover_image)?.url ??
      product.description_images?.find((i) => i.mediaType !== 'video')?.url ??
      '';
    // send() never throws; it reports failure by returning false.
    const delivered = await EmailProcessor.send('back-in-stock', {
        email: alert.email,
        products: [
          {
            name: alert.attribute ? `${product.name} (${alert.attribute.name}: ${alert.attribute.value})` : product.name,
            imagePath: image,
            slug: product.slug,
            price: product.price,
          },
        ],
        shopLink: productUrl(brand, product.slug),
      });
    if (delivered) {
      sent++;
    } else {
      logger.warn(`[stock-alerts] email to ${alert.email} failed; will retry on the next restock`);
      await StockAlert.updateOne({ _id: alert._id }, { $set: { pending: true }, $unset: { notifiedAt: 1 } });
    }
  }
  if (sent) logger.info(`[stock-alerts] sent ${sent} back-in-stock email(s)`);
  return sent;
}

/** Fire-and-forget wrapper for stock-changing code paths. */
function notifyIfRestocked(productIds: Array<string | Types.ObjectId>): void {
  checkRestocked(productIds).catch((error) => logger.error('[stock-alerts] restock check failed', error));
}

/** Admin: products with waiting alerts, most-requested first. */
const summary = async (opts: { page?: number; limit?: number }) => {
  try {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const rows = await StockAlert.aggregate([
      {
        $group: {
          _id: '$product',
          waiting: { $sum: { $cond: [{ $eq: ['$pending', true] }, 1, 0] } },
          notified: { $sum: { $cond: [{ $ifNull: ['$notifiedAt', false] }, 1, 0] } },
          lastRequestedAt: { $max: '$createdAt' },
          lastNotifiedAt: { $max: '$notifiedAt' },
        },
      },
      { $sort: { waiting: -1, lastRequestedAt: -1 } },
      {
        $facet: {
          total: [{ $count: 'n' }],
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                productId: '$_id',
                waiting: 1,
                notified: 1,
                lastRequestedAt: 1,
                lastNotifiedAt: 1,
                product: { name: '$product.name', slug: '$product.slug', stock: '$product.stock', sku: '$product.sku' },
              },
            },
          ],
        },
      },
    ]);
    const total = rows[0]?.total[0]?.n ?? 0;
    return {
      message: 'Stock alerts retrieved successfully',
      data: rows[0]?.items ?? [],
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error summarising stock alerts:', error);
    return { message: 'Failed to retrieve stock alerts', data: null, code: 500 };
  }
};

/** Admin: the alerts for one product. */
const listForProduct = async (productId: string) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) return { message: 'Invalid product id', data: null, code: 400 };
    const alerts = await StockAlert.find({ product: productId }).sort({ createdAt: -1 }).limit(500).lean();
    return { message: 'Stock alerts retrieved successfully', data: alerts, code: 200 };
  } catch (error) {
    console.error('Error listing stock alerts:', error);
    return { message: 'Failed to retrieve stock alerts', data: null, code: 500 };
  }
};

const StockAlertService = { createAlert, checkRestocked, notifyIfRestocked, summary, listForProduct };
export default StockAlertService;
