/**
 * Recovery Migration Script: Actually create and upload WebP files to Bunny CDN
 * 
 * The previous migration updated DB paths to .webp but the actual WebP files
 * were never uploaded to CDN. This script:
 * 1. Reads current DB paths (already .webp)
 * 2. Probes CDN for the original file (trying .png, .jpeg, .jpg, .avif, .gif)
 * 3. Downloads the original, converts to WebP base + mini
 * 4. Uploads both versions to CDN
 * 5. Verifies the uploads succeeded
 *
 * Usage:
 *   npm run migrate:images:recovery -- --dry-run   # Preview what would happen
 *   npm run migrate:images:recovery                 # Actually run
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
import { processImageFile, getMiniFilename } from '../src/utils/ImageProcessor';

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

// Extensions to probe for the original file on CDN
const PROBE_EXTENSIONS = ['.png', '.jpeg', '.jpg', '.avif', '.gif', '.PNG', '.JPEG', '.JPG'];

// Statistics
const stats = {
  total: 0,
  uploaded: 0,
  alreadyExists: 0,
  originalNotFound: 0,
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

/**
 * Check if a file exists on CDN (HTTP HEAD)
 */
async function existsOnCdn(relativePath: string): Promise<boolean> {
  try {
    await axios.head(cdnUrl(relativePath), { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Given a .webp path in DB, probe CDN for the original file with different extensions.
 * Returns the download URL of the original, or null if not found.
 */
async function findOriginalOnCdn(webpPath: string): Promise<string | null> {
  // Strip the .webp extension to get the base name
  const baseName = webpPath.replace(/\.webp$/, '');

  for (const ext of PROBE_EXTENSIONS) {
    const url = cdnUrl(baseName + ext);
    try {
      await axios.head(url, { timeout: 8000 });
      return url; // Found it
    } catch {
      // Try next extension
    }
  }

  // Also check if the original path (without .webp) already had an extension stored somewhere
  // e.g., maybe the path itself is the original
  try {
    await axios.head(cdnUrl(webpPath), { timeout: 8000 });
    return cdnUrl(webpPath); // The .webp file already exists!
  } catch {
    // Not found either
  }

  return null;
}

/**
 * Upload buffer to Bunny CDN
 */
async function uploadToBunny(buffer: Buffer, path: string): Promise<boolean> {
  try {
    const zone = getZone();
    const webStream = bufferToWebStream(buffer);
    const success = await BunnyStorageSDK.file.upload(zone, `/${path}`, webStream, {
      contentType: 'image/webp',
    });
    return success;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`    ❌ Upload failed for ${path}: ${msg}`);
    return false;
  }
}

/**
 * Process a single webp path: find original → download → convert → upload base + mini
 * Returns true if both files were uploaded successfully
 */
async function processPath(webpPath: string): Promise<boolean> {
  stats.total++;

  // Skip non-bunny URLs (external placeholders etc.)
  if (webpPath.startsWith('http') && !webpPath.includes(BUNNY_BASE_URL)) {
    console.log(`  ⏭️  External URL, skip: ${webpPath}`);
    stats.skipped++;
    return false;
  }

  // Clean path (remove any accidental protocol prefix)
  const cleanPath = webpPath.replace(/^https?:\/\/[^/]+\//, '');
  const miniPath = getMiniFilename(cleanPath);

  // Step 1: Check if .webp already exists on CDN
  const webpExists = await existsOnCdn(cleanPath);
  if (webpExists) {
    // Also check mini
    const miniExists = await existsOnCdn(miniPath);
    if (miniExists) {
      console.log(`  ✅ Already on CDN: ${cleanPath} + mini`);
      stats.alreadyExists++;
      return true;
    }
    // base exists but mini doesn't — we need to create mini
    console.log(`  ⚠️  Base exists but mini missing, will create mini`);
  }

  // Step 2: Find the original file on CDN
  const originalUrl = await findOriginalOnCdn(cleanPath);
  if (!originalUrl) {
    console.log(`  ❌ Original not found on CDN for: ${cleanPath}`);
    stats.originalNotFound++;
    stats.errors.push({ path: cleanPath, error: 'Original file not found on CDN' });
    return false;
  }

  console.log(`  📥 Found original: ${originalUrl}`);

  if (DRY_RUN) {
    console.log(`  🔍 [DRY RUN] Would download, convert, and upload:`);
    console.log(`       Base: ${cleanPath}`);
    console.log(`       Mini: ${miniPath}`);
    stats.uploaded++;
    return true;
  }

  // Step 3: Download original
  let imageBuffer: Buffer;
  try {
    const response = await axios.get(originalUrl, { responseType: 'arraybuffer', timeout: 30000 });
    imageBuffer = Buffer.from(response.data);
    console.log(`  📥 Downloaded: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ❌ Download failed: ${msg}`);
    stats.failed++;
    stats.errors.push({ path: cleanPath, error: `Download failed: ${msg}` });
    return false;
  }

  // Step 4: Convert to WebP (base + mini)
  let baseBuffer: Buffer;
  let miniBuffer: Buffer;
  try {
    const result = await processImageFile(imageBuffer);
    baseBuffer = result.baseBuffer;
    miniBuffer = result.miniBuffer;
    console.log(`  🔄 Converted: base=${(baseBuffer.length / 1024).toFixed(1)}KB, mini=${(miniBuffer.length / 1024).toFixed(1)}KB`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ❌ Conversion failed: ${msg}`);
    stats.failed++;
    stats.errors.push({ path: cleanPath, error: `Conversion failed: ${msg}` });
    return false;
  }

  // Step 5: Upload base version (skip if already exists)
  if (!webpExists) {
    console.log(`  ⬆️  Uploading base: ${cleanPath}`);
    const baseOk = await uploadToBunny(baseBuffer, cleanPath);
    if (!baseOk) {
      stats.failed++;
      stats.errors.push({ path: cleanPath, error: 'Base upload failed' });
      return false;
    }
  }

  // Step 6: Upload mini version
  console.log(`  ⬆️  Uploading mini: ${miniPath}`);
  const miniOk = await uploadToBunny(miniBuffer, miniPath);
  if (!miniOk) {
    stats.failed++;
    stats.errors.push({ path: miniPath, error: 'Mini upload failed' });
    return false;
  }

  // Step 7: Verify uploads
  const baseVerified = await existsOnCdn(cleanPath);
  const miniVerified = await existsOnCdn(miniPath);
  if (baseVerified && miniVerified) {
    console.log(`  ✅ Verified both uploaded successfully`);
    stats.uploaded++;
    return true;
  } else {
    console.log(`  ⚠️  Upload verification failed (base=${baseVerified}, mini=${miniVerified})`);
    stats.failed++;
    stats.errors.push({ path: cleanPath, error: `Verification failed: base=${baseVerified}, mini=${miniVerified}` });
    return false;
  }
}

/**
 * Collect all unique image paths from the database
 */
async function collectAllPaths(): Promise<Set<string>> {
  const paths = new Set<string>();

  // Products - description_images
  const products = await Product.find({}).lean();
  for (const p of products) {
    if (!p.description_images) continue;
    for (const img of p.description_images) {
      if (img.url) paths.add(img.url);
      if (img.miniUrl) paths.add(img.miniUrl);
    }
  }

  // Users
  const users = await User.find({ image: { $exists: true, $ne: '' } }).lean();
  for (const u of users) {
    if (u.image) paths.add(u.image);
    if (u.miniImage) paths.add(u.miniImage);
  }

  // Campaigns
  const campaigns = await Campaign.find({ image: { $exists: true, $ne: '' } }).lean();
  for (const c of campaigns) {
    if (c.image) paths.add(c.image);
    // @ts-ignore
    if (c.miniImage) paths.add(c.miniImage);
  }

  // Banners
  const banners = await Banner.find({ imageUrl: { $exists: true, $ne: '' } }).lean();
  for (const b of banners) {
    if (b.imageUrl) paths.add(b.imageUrl);
    // @ts-ignore
    if (b.miniImageUrl) paths.add(b.miniImageUrl);
  }

  // Categories (skip AWS placeholder images)
  const categories = await Category.find({ image: { $exists: true, $ne: '' } }).lean();
  for (const c of categories) {
    if (c.image && !c.image.includes('amazonaws.com')) paths.add(c.image);
    // @ts-ignore
    if (c.miniImage) paths.add(c.miniImage);
  }

  // Attributes
  const attributes = await Attribute.find({ 'children.image': { $exists: true } }).lean();
  for (const a of attributes) {
    if (!a.children) continue;
    for (const child of a.children) {
      if (child.image) paths.add(child.image);
      // @ts-ignore
      if (child.miniImage) paths.add(child.miniImage);
    }
  }

  return paths;
}

/**
 * Group paths: for each base path, figure out if we need to process it.
 * We deduplicate so each base image is processed only once (base + mini together).
 */
function deduplicateToBasePaths(paths: Set<string>): string[] {
  const basePaths = new Set<string>();

  for (const p of paths) {
    // Skip external URLs
    if (p.startsWith('http') && !p.includes(BUNNY_BASE_URL)) continue;

    // Convert mini path back to base path for dedup
    const cleanPath = p.replace(/^https?:\/\/[^/]+\//, '');
    const basePath = cleanPath.replace(/-mini\.webp$/, '.webp');
    basePaths.add(basePath);
  }

  return Array.from(basePaths);
}

async function main() {
  console.log('🔧 Recovery Migration: Upload WebP files to Bunny CDN\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '✏️  LIVE RUN'}`);
  console.log(`Bunny CDN: ${BUNNY_BASE_URL}`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  if (!BUNNY_BASE_URL) {
    console.error('❌ BUNNY_BASE_URL is not set!');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Collect all image paths from all models
    console.log('📋 Collecting all image paths from database...');
    const allPaths = await collectAllPaths();
    console.log(`   Found ${allPaths.size} total paths`);

    // Step 2: Deduplicate to base paths
    const basePaths = deduplicateToBasePaths(allPaths);
    console.log(`   Deduplicated to ${basePaths.length} unique base images to process\n`);

    // Step 3: Process each base path in batches
    for (let i = 0; i < basePaths.length; i += BATCH_SIZE) {
      const batch = basePaths.slice(i, i + BATCH_SIZE);
      console.log(`\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(basePaths.length / BATCH_SIZE)} ---`);

      for (const path of batch) {
        console.log(`\n🖼️  Processing: ${path}`);
        await processPath(path);
      }
    }

    // Final report
    console.log('\n' + '='.repeat(60));
    console.log('📊 RECOVERY MIGRATION REPORT');
    console.log('='.repeat(60));
    console.log(`Total paths checked:   ${stats.total}`);
    console.log(`Uploaded (new):        ${stats.uploaded}`);
    console.log(`Already on CDN:        ${stats.alreadyExists}`);
    console.log(`Original not found:    ${stats.originalNotFound}`);
    console.log(`Failed:                ${stats.failed}`);
    console.log(`Skipped (external):    ${stats.skipped}`);
    console.log('='.repeat(60));

    if (stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      for (const err of stats.errors) {
        console.log(`   ${err.path}: ${err.error}`);
      }
    }

    if (DRY_RUN) {
      console.log('\n🔍 This was a dry run. Run without --dry-run to apply.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Done.');
  }
}

main().catch(console.error);
