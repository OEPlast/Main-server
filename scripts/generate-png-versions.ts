/**
 * Migration Script: Generate PNG versions for existing WebP images on Bunny CDN
 * 
 * The upload pipeline now creates 3 versions: base.webp, base-mini.webp, base.png
 * This script creates the PNG version for images already on CDN that only have WebP.
 *
 * For each .webp path in DB:
 * 1. Check if .png already exists on CDN → skip
 * 2. Download the .webp file
 * 3. Convert to PNG using Sharp
 * 4. Upload the .png to CDN
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/generate-png-versions.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/generate-png-versions.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../src/models/Product';
import User from '../src/models/User';
import Campaign from '../src/models/Campaign';
import Banner from '../src/models/Banner';
import Category from '../src/models/Category';
import Attribute from '../src/models/Attributes';
import axios from 'axios';
import * as BunnyStorageSDK from '@bunny.net/storage-sdk';
import { ReadableStream } from 'stream/web';
import { convertToPng, getPngFilename } from '../src/utils/ImageProcessor';

dotenv.config();

// Configuration
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || '';
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY || '';
const BUNNY_REGION_ENV = (process.env.BUNNY_REGION ||
  'Falkenstein') as keyof typeof BunnyStorageSDK.regions.StorageRegion;
const BUNNY_REGION =
  BunnyStorageSDK.regions.StorageRegion[BUNNY_REGION_ENV] || BunnyStorageSDK.regions.StorageRegion.Falkenstein;
const BUNNY_BASE_URL = process.env.BUNNY_BASE_URL || '';
const MONGO_URL = process.env.MONGODB_URI as string;
const BATCH_SIZE = 5;
const DRY_RUN = process.argv.includes('--dry-run');

// Statistics
const stats = {
  total: 0,
  created: 0,
  alreadyExists: 0,
  failed: 0,
  skipped: 0,
  errors: [] as Array<{ path: string; error: string }>,
};

// Bunny connection
let zoneConnection: BunnyStorageSDK.StorageZone | null = null;
const getZone = () => {
  if (zoneConnection) return zoneConnection;
  zoneConnection = BunnyStorageSDK.zone.connect_with_accesskey(BUNNY_REGION, BUNNY_STORAGE_ZONE, BUNNY_ACCESS_KEY);
  return zoneConnection;
};

function cdnUrl(relativePath: string): string {
  return `https://${BUNNY_BASE_URL}/${relativePath.replace(/^\//, '')}`;
}

const bufferToWebStream = (buffer: Buffer): ReadableStream<Uint8Array> => {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
};

async function existsOnCdn(relativePath: string): Promise<boolean> {
  try {
    await axios.head(cdnUrl(relativePath), { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

async function uploadPngToBunny(buffer: Buffer, path: string): Promise<boolean> {
  try {
    const zone = getZone();
    const webStream = bufferToWebStream(buffer);
    const success = await BunnyStorageSDK.file.upload(zone, `/${path}`, webStream, {
      contentType: 'image/png',
    });
    return success;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`    ❌ Upload failed for ${path}: ${msg}`);
    return false;
  }
}

/**
 * Process a single webp path: download → convert to PNG → upload
 */
async function processPath(webpPath: string): Promise<boolean> {
  stats.total++;

  // Skip non-bunny URLs (external placeholders etc.)
  if (webpPath.startsWith('http') && !webpPath.includes(BUNNY_BASE_URL)) {
    console.log(`  ⏭️  External URL, skip: ${webpPath}`);
    stats.skipped++;
    return false;
  }

  // Skip non-webp paths
  if (!webpPath.endsWith('.webp')) {
    console.log(`  ⏭️  Not a .webp path, skip: ${webpPath}`);
    stats.skipped++;
    return false;
  }

  // Clean path (remove any accidental protocol prefix)
  const cleanPath = webpPath.replace(/^https?:\/\/[^/]+\//, '');
  // Skip mini versions - we only create PNG for base images
  if (cleanPath.includes('-mini.')) {
    stats.skipped++;
    return false;
  }

  const pngPath = getPngFilename(cleanPath);

  // Check if PNG already exists on CDN
  const pngExists = await existsOnCdn(pngPath);
  if (pngExists) {
    console.log(`  ✅ PNG already exists: ${pngPath}`);
    stats.alreadyExists++;
    return true;
  }

  // Check the WebP source exists
  const webpExists = await existsOnCdn(cleanPath);
  if (!webpExists) {
    console.log(`  ❌ Source WebP not found on CDN: ${cleanPath}`);
    stats.failed++;
    stats.errors.push({ path: cleanPath, error: 'Source WebP not found' });
    return false;
  }

  if (DRY_RUN) {
    console.log(`  🔍 [DRY RUN] Would create PNG: ${pngPath}`);
    stats.created++;
    return true;
  }

  // Download WebP
  let imageBuffer: Buffer;
  try {
    const response = await axios.get(cdnUrl(cleanPath), { responseType: 'arraybuffer', timeout: 30000 });
    imageBuffer = Buffer.from(response.data);
    console.log(`  📥 Downloaded WebP: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ❌ Download failed: ${msg}`);
    stats.failed++;
    stats.errors.push({ path: cleanPath, error: `Download failed: ${msg}` });
    return false;
  }

  // Convert to PNG
  let pngBuffer: Buffer;
  try {
    pngBuffer = await convertToPng(imageBuffer);
    console.log(`  🔄 Converted to PNG: ${(pngBuffer.length / 1024).toFixed(1)} KB`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ❌ PNG conversion failed: ${msg}`);
    stats.failed++;
    stats.errors.push({ path: cleanPath, error: `Conversion failed: ${msg}` });
    return false;
  }

  // Upload PNG
  const success = await uploadPngToBunny(pngBuffer, pngPath);
  if (success) {
    console.log(`  ✅ Uploaded PNG: ${pngPath}`);
    stats.created++;
    return true;
  } else {
    stats.failed++;
    stats.errors.push({ path: pngPath, error: 'Upload failed' });
    return false;
  }
}

/**
 * Collect unique image paths from all models
 */
async function collectAllImagePaths(): Promise<string[]> {
  const paths = new Set<string>();

  // Products
  const products = await Product.find({}, 'description_images thumbnail').lean();
  for (const p of products) {
    const prod = p as Record<string, unknown>;
    if (Array.isArray(prod.description_images)) {
      for (const img of prod.description_images) {
        const imageObj = img as Record<string, unknown>;
        if (typeof imageObj.url === 'string' && imageObj.url) paths.add(imageObj.url);
      }
    }
    if (typeof prod.thumbnail === 'string' && prod.thumbnail) paths.add(prod.thumbnail);
  }

  // Users (avatars)
  const users = await User.find({}, 'avatar').lean();
  for (const u of users) {
    const user = u as Record<string, unknown>;
    if (typeof user.avatar === 'string' && user.avatar) paths.add(user.avatar);
  }

  // Categories
  const categories = await Category.find({}, 'image').lean();
  for (const c of categories) {
    const cat = c as Record<string, unknown>;
    if (typeof cat.image === 'string' && cat.image) paths.add(cat.image);
  }

  // Campaigns
  try {
    const campaigns = await Campaign.find({}, 'image banner').lean();
    for (const c of campaigns) {
      const camp = c as Record<string, unknown>;
      if (typeof camp.image === 'string' && camp.image) paths.add(camp.image);
      if (typeof camp.banner === 'string' && camp.banner) paths.add(camp.banner);
    }
  } catch {
    console.log('⚠️  Campaign model not found, skipping');
  }

  // Banners
  try {
    const banners = await Banner.find({}, 'image').lean();
    for (const b of banners) {
      const banner = b as Record<string, unknown>;
      if (typeof banner.image === 'string' && banner.image) paths.add(banner.image);
    }
  } catch {
    console.log('⚠️  Banner model not found, skipping');
  }

  // Attributes
  try {
    const attrs = await Attribute.find({}, 'image').lean();
    for (const a of attrs) {
      const attr = a as Record<string, unknown>;
      if (typeof attr.image === 'string' && attr.image) paths.add(attr.image);
    }
  } catch {
    console.log('⚠️  Attribute model not found, skipping');
  }

  return Array.from(paths);
}

/**
 * Process paths in batches
 */
async function processBatch(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    console.log(`\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(paths.length / BATCH_SIZE)} ---`);
    await Promise.all(batch.map((p) => processPath(p)));
  }
}

async function main() {
  console.log('🖼️  PNG Version Generator');
  console.log('========================');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no uploads)' : '🚀 LIVE'}\n`);

  if (!MONGO_URL) {
    console.error('❌ MONGODB_URI not set');
    process.exit(1);
  }
  if (!BUNNY_STORAGE_ZONE || !BUNNY_ACCESS_KEY) {
    console.error('❌ Bunny storage not configured');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URL);
  console.log('✅ Connected to MongoDB\n');

  // Collect all image paths
  console.log('📋 Collecting image paths from DB...');
  const allPaths = await collectAllImagePaths();
  console.log(`   Found ${allPaths.length} unique image paths\n`);

  // Process
  await processBatch(allPaths);

  // Report
  console.log('\n================================');
  console.log('📊 Migration Summary');
  console.log('================================');
  console.log(`Total paths processed: ${stats.total}`);
  console.log(`PNG created:           ${stats.created}`);
  console.log(`Already had PNG:       ${stats.alreadyExists}`);
  console.log(`Skipped (non-CDN):     ${stats.skipped}`);
  console.log(`Failed:                ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const e of stats.errors) {
      console.log(`   ${e.path}: ${e.error}`);
    }
  }

  await mongoose.disconnect();
  console.log('\n✅ Done');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
