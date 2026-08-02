/**
 * Migration Script: Backfill denormalized product rating stats
 *
 * `ratingAverage` / `ratingCount` are maintained on the Product by the review
 * write path (reviewService.syncProductRatingStats), but that only runs when a
 * review is created, updated or deleted. Products whose reviews predate that
 * hook — and every product that has never had a review touched since — still
 * carry the schema defaults of 0.
 *
 * This recomputes both fields for every product from the Review collection,
 * counting only reviews that are publicly visible (isApproved !== false), which
 * is the same rule the storefront and the Product JSON-LD aggregateRating use.
 *
 * Safe to re-run: it is idempotent and only writes where a value actually changes.
 *
 * Usage:
 *   npx ts-node scripts/migrations/backfill-product-ratings.ts
 *
 * Dry run (report what would change, write nothing):
 *   npx ts-node scripts/migrations/backfill-product-ratings.ts --dry-run
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Product from '../../src/models/Product';
import Review from '../../src/models/Review';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI or DATABASE_URL not found in environment variables');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

// Mongo's bulkWrite has no practical cap here, but batching keeps memory flat
// on large catalogues.
const BATCH_SIZE = 500;

const round1 = (value: number): number => Math.round(value * 10) / 10;

async function backfill() {
  try {
    console.log(`🚀 Starting migration: Backfill product rating stats${isDryRun ? ' (DRY RUN)' : ''}`);
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);

    // One pass over reviews → { productId: { count, avg } }. Cheaper and far
    // fewer round trips than aggregating per product.
    console.log('⚙️  Aggregating approved reviews by product...');
    const grouped = await Review.aggregate<{ _id: mongoose.Types.ObjectId; count: number; avg: number }>([
      { $match: { isApproved: { $ne: false } } },
      { $group: { _id: '$product', count: { $sum: 1 }, avg: { $avg: '$rating' } } },
    ]);
    console.log(`🔍 Products with at least one approved review: ${grouped.length}`);

    const statsByProduct = new Map<string, { ratingCount: number; ratingAverage: number }>();
    for (const row of grouped) {
      statsByProduct.set(String(row._id), {
        ratingCount: row.count ?? 0,
        ratingAverage: row.avg ? round1(row.avg) : 0,
      });
    }

    // Walk every product so those that should be reset to 0 (all reviews deleted
    // or rejected) are corrected too, not just those that currently have reviews.
    const cursor = Product.find({}, { _id: 1, ratingAverage: 1, ratingCount: 1 }).lean().cursor();

    let scanned = 0;
    let changed = 0;
    let operations: Parameters<typeof Product.bulkWrite>[0] = [];

    const flush = async () => {
      if (operations.length === 0) return;
      if (!isDryRun) await Product.bulkWrite(operations);
      operations = [];
    };

    for await (const product of cursor) {
      scanned += 1;
      const next = statsByProduct.get(String(product._id)) ?? { ratingCount: 0, ratingAverage: 0 };
      const currentCount = product.ratingCount ?? 0;
      const currentAverage = product.ratingAverage ?? 0;

      if (currentCount === next.ratingCount && currentAverage === next.ratingAverage) continue;

      changed += 1;
      operations.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { ratingCount: next.ratingCount, ratingAverage: next.ratingAverage } },
        },
      });

      if (operations.length >= BATCH_SIZE) await flush();
    }

    await flush();

    console.log(`✅ ${isDryRun ? 'Dry run' : 'Migration'} completed successfully!`);
    console.log(`   - Scanned:  ${scanned} products`);
    console.log(`   - ${isDryRun ? 'Would update' : 'Updated'}: ${changed} products`);
    console.log(`   - Unchanged: ${scanned - changed} products`);

    if (!isDryRun) {
      const withRatings = await Product.countDocuments({ ratingCount: { $gt: 0 } });
      console.log(`✓ Verification: ${withRatings}/${totalProducts} products now carry a rating`);
    }

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
    console.log('🎉 Backfill script finished successfully!');
  } catch (error) {
    console.error('\n❌ Backfill failed with error:');
    console.error(error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

backfill();
