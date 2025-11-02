/*
  Migration: Backfill campaign slugs
  - Generates slug from title if missing
  - Normalizes to lowercase, replaces non [a-z0-9] with '-', collapses dashes, trims
  - Ensures global uniqueness by suffixing -2, -3, ... on collisions

  Usage:
    ts-node -r tsconfig-paths/register scripts/migrations/backfill-campaign-slugs.ts
*/

import mongoose from 'mongoose';
import Campaign from '@/models/Campaign';

function normalizeSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'campaign';
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await Campaign.exists({ slug });
    if (!exists) return slug;
    slug = `${base}-${suffix++}`;
  }
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || '';
  if (!mongoUri) {
    console.error('Missing MONGODB_URI or DATABASE_URL environment variable');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const campaigns = await Campaign.find({});
  console.log(`Found ${campaigns.length} campaigns`);

  let updated = 0;

  for (const c of campaigns) {
    // Access possibly missing field safely
    const slugRaw = (c as unknown as { slug?: unknown }).slug;
    const slug = typeof slugRaw === 'string' ? slugRaw : undefined;
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      const base = normalizeSlug(c.title || 'campaign');
      const unique = await ensureUniqueSlug(base);
      (c as unknown as { slug?: string }).slug = unique;
      await c.save();
      updated++;
      console.log(`Updated campaign ${c._id} -> slug: ${unique}`);
    }
  }

  console.log(`Backfill complete. Updated ${updated} documents.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
