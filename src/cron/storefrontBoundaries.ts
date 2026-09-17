import cron from 'node-cron';
import mongoose from 'mongoose';
import Sales from '@/models/Sales';
import Campaign from '@/models/Campaign';
import Product from '@/models/Product';
import { logger } from '@/lib/logger';
import {
  campaignTag,
  productTag,
  requestStorefrontRevalidation,
  StorefrontTag,
} from '@/services/storefront/revalidate';

/**
 * Purges the storefront's cache when a scheduled sale or campaign *starts or ends*.
 *
 * Every other revalidation in this codebase hangs off a write: someone saves a product, places an
 * order, edits a campaign. A flash sale beginning at 09:00 is different — nothing is written at
 * 09:00. Without this, the cached product page, the deals page and the home rails would go on
 * showing yesterday's prices until their 12-hour revalidation, and the sale would effectively not
 * exist for anyone who didn't force a refresh.
 *
 * It runs every minute and looks back two minutes, so a boundary is always inside at least one
 * window even if a run is skipped or slow. Re-purging a tag is harmless — the page regenerates once
 * on its next visit either way.
 */

const LOOKBACK_MS = 2 * 60 * 1000;
let running = false;

async function runBoundarySweep(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const since = new Date(now.getTime() - LOOKBACK_MS);
    const crossed = { $gte: since, $lte: now };

    const [sales, campaigns] = await Promise.all([
      Sales.find({ $or: [{ startDate: crossed }, { endDate: crossed }] })
        .select('product campaign')
        .lean<Array<{ product?: mongoose.Types.ObjectId; campaign?: mongoose.Types.ObjectId; }>>(),
      Campaign.find({ $or: [{ startDate: crossed }, { endDate: crossed }] })
        .select('slug')
        .lean<Array<{ slug?: string; }>>(),
    ]);

    if (sales.length === 0 && campaigns.length === 0) return;

    const tags = new Set<string>();

    if (sales.length > 0) {
      const productIds = sales.map((s) => s.product).filter(Boolean);
      const products = await Product.find({ _id: { $in: productIds } })
        .select('slug slugHistory')
        .lean<Array<{ slug?: string; slugHistory?: string[]; }>>();
      for (const product of products) {
        if (product.slug) tags.add(productTag(product.slug));
        for (const old of product.slugHistory ?? []) if (old) tags.add(productTag(old));
      }

      const campaignIds = sales.map((s) => s.campaign).filter(Boolean);
      if (campaignIds.length > 0) {
        const linked = await Campaign.find({ _id: { $in: campaignIds } })
          .select('slug')
          .lean<Array<{ slug?: string; }>>();
        for (const c of linked) if (c.slug) tags.add(campaignTag(c.slug));
      }
      // A sale opening or closing changes the deals page and every listing's prices.
      tags.add(StorefrontTag.PRODUCTS);
    }

    for (const campaign of campaigns) {
      if (campaign.slug) tags.add(campaignTag(campaign.slug));
    }
    if (campaigns.length > 0) {
      tags.add(StorefrontTag.CAMPAIGNS);
      tags.add(StorefrontTag.PRODUCTS);
    }

    requestStorefrontRevalidation([...tags]);
    logger.info(
      `[storefront-boundaries] ${sales.length} sale(s), ${campaigns.length} campaign(s) crossed a boundary; purging ${tags.size} tag(s)`
    );
  } catch (error) {
    logger.error('[storefront-boundaries] sweep failed:', error);
  } finally {
    running = false;
  }
}

export function startStorefrontBoundaries(): void {
  cron.schedule('* * * * *', () => {
    void runBoundarySweep();
  });
  logger.info('[storefront-boundaries] Started: every minute');
}
