/**
 * Seed Script: Intent shops
 *
 * Intent shops used to live in the storefront's `src/config/intents.ts` as a
 * hard-coded record. They are now stored in MongoDB and managed from the admin
 * panel (Marketing → Intent Shops). This script migrates the one seed entry that
 * existed in that file so the `/shop/affordable-office-chairs` URL keeps working
 * — it is already indexed and dropping it would produce a 404 for a live page.
 *
 * Products are now hand-picked rather than filtered, so the script resolves the
 * old `fetch.q` into concrete product ids by matching product names, cheapest
 * first (the original intent sorted by price ascending).
 *
 * Idempotent:
 *   - unknown slug            → created
 *   - exists without products → repaired (products backfilled)
 *   - exists with products    → skipped, never overwritten
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-intents.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Intent, { MIN_PUBLISHED_PRODUCTS } from '../src/models/Intent';
import Product from '../src/models/Product';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oeplast';

/** How many products to curate into a seeded page. */
const PRODUCT_LIMIT = 12;

const SEED_INTENTS = [
  {
    slug: 'affordable-office-chairs',
    heading: 'Affordable Office Chairs in Nigeria',
    title: 'Affordable Office Chairs in Nigeria — Cheap & Quality',
    description:
      'Buy affordable office chairs in Nigeria. Comfortable, durable and budget-friendly chairs for home and office, with free delivery nationwide and 7-day returns.',
    keywords: [
      'affordable office chairs',
      'cheap office chairs Nigeria',
      'office chair Lagos',
      'budget office chair',
    ],
    intro:
      'Looking for a comfortable office chair that will not break the bank? These affordable office chairs are picked for value, comfort and durability — ideal for home offices and workspaces across Nigeria.',
    /** Resolved into product ids at run time. */
    productQuery: 'office chair',
    faqs: [
      {
        question: 'How much does an affordable office chair cost in Nigeria?',
        answer:
          'Prices vary by design and material. Rawura lists budget-friendly office chairs sorted by price so you can find the best value, with free delivery nationwide.',
      },
      {
        question: 'Do office chairs come with free delivery?',
        answer:
          'Yes. All eligible products ship free across Nigeria, with a 7-day return window.',
      },
    ],
  },
];

async function resolveProducts(query: string): Promise<string[]> {
  // Escape regex metacharacters — the query is copy from a config file, not a pattern.
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const products = await Product.find({
    status: 'active',
    name: { $regex: safe, $options: 'i' },
  })
    .select('_id')
    .sort({ price: 1 })
    .limit(PRODUCT_LIMIT)
    .lean();

  return products.map((p) => String(p._id));
}

async function seedIntents() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    let created = 0;
    let repaired = 0;
    let skipped = 0;

    for (const { productQuery, ...seed } of SEED_INTENTS) {
      const productIds = await resolveProducts(productQuery);

      if (productIds.length === 0) {
        console.log(
          `⚠️  Skipped "${seed.slug}" — no active products matched "${productQuery}". Pick products manually in the admin panel.`
        );
        skipped += 1;
        continue;
      }

      // Too few products to publish, so seed it as a draft rather than fail.
      const status = productIds.length >= MIN_PUBLISHED_PRODUCTS ? 'active' : 'draft';
      if (status === 'draft') {
        console.log(
          `⚠️  Only ${productIds.length} product(s) matched "${productQuery}" — seeding "${seed.slug}" as a DRAFT (needs ${MIN_PUBLISHED_PRODUCTS} to publish).`
        );
      }

      const existing = await Intent.findOne({ slug: seed.slug });

      if (existing) {
        if (existing.products?.length) {
          console.log(`⏭️  Skipped "${seed.slug}" — already exists with ${existing.products.length} product(s)`);
          skipped += 1;
          continue;
        }

        // Pre-products document (or one left empty) — backfill it.
        existing.set({ products: productIds, status });
        await existing.save();
        console.log(`🔧 Repaired "${seed.slug}" — attached ${productIds.length} product(s), status ${status}`);
        repaired += 1;
        continue;
      }

      await Intent.create({ ...seed, products: productIds, status });
      console.log(`✅ Created "${seed.slug}" — ${productIds.length} product(s), status ${status}`);
      created += 1;
    }

    console.log(`\n📊 Done — ${created} created, ${repaired} repaired, ${skipped} skipped.`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

seedIntents();
