/**
 * Migration Script: Convert existing images to WebP with mini versions
 *
 * This script:
 * 1. Fetches all documents with image fields from all models
 * 2. Downloads original images from Bunny CDN
 * 3. Converts to WebP (base + mini versions)
 * 4. Uploads new versions to Bunny
 * 5. Updates database with new paths
 *
 * Usage:
 *   npm run migrate:images -- --dry-run  # Test without making changes
 *   npm run migrate:images                # Run actual migration
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
const MONGO_URL = process.env.MONGODB_URI as unknown as string;
const BATCH_SIZE = 10; // Process 10 items at a time
const DRY_RUN = process.argv.includes('--dry-run');

// Statistics
const stats = {
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  errors: [] as Array<{ item: string; error: string }>,
};

// Bunny connection
let zoneConnection: BunnyStorageSDK.StorageZone | null = null;
const getZone = () => {
  if (zoneConnection) return zoneConnection;
  zoneConnection = BunnyStorageSDK.zone.connect_with_accesskey(BUNNY_REGION, BUNNY_STORAGE_ZONE, BUNNY_ACCESS_KEY);
  return zoneConnection;
};

// Convert Buffer to Web ReadableStream
const bufferToWebStream = (buffer: Buffer): ReadableStream<Uint8Array> => {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
};

/**
 * Ensure URL has protocol (https://)
 */
function ensureFullUrl(url: string): string {
  // Already a full URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Validate BUNNY_BASE_URL is set
  if (!BUNNY_BASE_URL || BUNNY_BASE_URL.trim() === '') {
    throw new Error('BUNNY_BASE_URL environment variable is not set');
  }
  
  // If BUNNY_BASE_URL already has protocol, use it directly
  if (BUNNY_BASE_URL.startsWith('http://') || BUNNY_BASE_URL.startsWith('https://')) {
    const baseUrl = BUNNY_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
    const relativePath = url.replace(/^\//, ''); // Remove leading slash
    return `${baseUrl}/${relativePath}`;
  }
  
  // Add https:// protocol to BUNNY_BASE_URL
  const baseUrl = BUNNY_BASE_URL.replace(/^\//, '').replace(/\/$/, ''); // Clean both ends
  const relativePath = url.replace(/^\//, ''); // Remove leading slash
  
  // Validate baseUrl is not empty after cleanup
  if (!baseUrl) {
    throw new Error('BUNNY_BASE_URL is empty after cleanup');
  }
  
  return `https://${baseUrl}/${relativePath}`;
}

/**
 * Download image from Bunny CDN
 */
async function downloadImage(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to download image from ${url}: ${errorMessage}`);
  }
}

/**
 * Upload buffer to Bunny CDN
 */
async function uploadToBunny(buffer: Buffer, path: string, mimetype: string): Promise<boolean> {
  try {
    const zone = getZone();
    const webStream = bufferToWebStream(buffer);
    const success = await BunnyStorageSDK.file.upload(zone, `/${path}`, webStream, {
      contentType: mimetype,
    });
    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to upload to Bunny at ${path}: ${errorMessage}`);
    return false;
  }
}

/**
 * Process a single image URL
 */
async function processImageUrl(originalUrl: string): Promise<{ basePath: string; miniPath: string } | null> {
  try {
    // Skip if already WebP
    if (originalUrl.endsWith('.webp')) {
      console.log(`  ⏭️  Skipping (already WebP): ${originalUrl}`);
      stats.skipped++;
      return null;
    }

    // Extract relative path from URL
    let relativePath: string;
    
    if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
      // It's a full URL - extract the path portion
      try {
        const urlObj = new URL(originalUrl);
        relativePath = urlObj.pathname.replace(/^\//, ''); // Remove leading slash
        
        // Validate we got a sensible path
        if (!relativePath || relativePath.startsWith('http')) {
          throw new Error('Invalid path extracted from URL');
        }
      } catch (urlError) {
        // Fallback: try string manipulation if URL parsing fails
        console.log(`  ⚠️  URL parsing failed, using string extraction`);
        relativePath = originalUrl
          .replace(/^https?:\/\//, '') // Remove protocol
          .replace(/^[^\/]+\//, '') // Remove domain
          .replace(/^\/+/, ''); // Remove leading slashes
      }
      
      // Skip if URL is external (not our CDN)
      if (!originalUrl.includes(BUNNY_BASE_URL.replace(/^https?:\/\//, ''))) {
        console.log(`  ⏭️  Skipping (external URL): ${originalUrl}`);
        stats.skipped++;
        return null;
      }
    } else {
      // It's already a relative path
      relativePath = originalUrl.replace(/^\//, '');
    }

    // Validate relative path
    if (!relativePath || relativePath.includes('://')) {
      throw new Error(`Invalid relative path extracted: ${relativePath}`);
    }

    if (DRY_RUN) {
      console.log(`  🔍 [DRY RUN] Would process: ${relativePath}`);
      stats.processed++;
      return {
        basePath: relativePath.replace(/\.[^.]+$/, '.webp'),
        miniPath: getMiniFilename(relativePath.replace(/\.[^.]+$/, '.webp')),
      };
    }

    // Download original image - ensure we have full URL
    const downloadUrl = originalUrl.startsWith('http') ? originalUrl : ensureFullUrl(originalUrl);
    console.log(`  ⬇️  Downloading: ${relativePath}`);
    const imageBuffer = await downloadImage(downloadUrl);

    // Process to WebP (base + mini)
    console.log(`  🔄 Converting to WebP...`);
    const { baseBuffer, miniBuffer } = await processImageFile(imageBuffer);

    // Generate new paths
    const baseWebpPath = relativePath.replace(/\.[^.]+$/, '.webp');
    const miniWebpPath = getMiniFilename(baseWebpPath);

    // Upload base version
    console.log(`  ⬆️  Uploading base: ${baseWebpPath}`);
    const baseSuccess = await uploadToBunny(baseBuffer, baseWebpPath, 'image/webp');
    if (!baseSuccess) {
      throw new Error('Failed to upload base version');
    }

    // Upload mini version
    console.log(`  ⬆️  Uploading mini: ${miniWebpPath}`);
    const miniSuccess = await uploadToBunny(miniBuffer, miniWebpPath, 'image/webp');
    if (!miniSuccess) {
      throw new Error('Failed to upload mini version');
    }

    stats.processed++;
    stats.succeeded++;
    return { basePath: baseWebpPath, miniPath: miniWebpPath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ❌ Error processing ${originalUrl}: ${errorMessage}`);
    stats.failed++;
    stats.errors.push({ item: originalUrl, error: errorMessage });
    return null;
  }
}

/**
 * Migrate Product images (description_images array)
 */
async function migrateProducts() {
  console.log('\n📦 Migrating Product images...');
  const products = await Product.find({}).lean();
  console.log(`Found ${products.length} products`);
  stats.total += products.length;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    for (const product of batch) {
      if (!product.description_images || product.description_images.length === 0) continue;

      console.log(`\nProcessing Product: ${product.name} (${product._id})`);

      const updatedImages = [];
      for (const img of product.description_images) {
        if (!img.url) continue;

        // Skip if already has miniUrl
        if (img.miniUrl) {
          console.log(`  ⏭️  Already has mini version`);
          updatedImages.push(img);
          continue;
        }

        const fullUrl = ensureFullUrl(img.url);
        const result = await processImageUrl(fullUrl);

        if (result) {
          updatedImages.push({
            url: result.basePath,
            miniUrl: result.miniPath,
            cover_image: img.cover_image,
          });
        } else {
          // Keep original if processing failed
          updatedImages.push(img);
        }
      }

      // Update database
      if (!DRY_RUN && updatedImages.length > 0) {
        await Product.updateOne({ _id: product._id }, { $set: { description_images: updatedImages } });
        console.log(`  ✅ Updated product in database`);
      }
    }
  }
}

/**
 * Migrate User images
 */
async function migrateUsers() {
  console.log('\n👤 Migrating User images...');
  const users = await User.find({ image: { $exists: true, $ne: '' } }).lean();
  console.log(`Found ${users.length} users with images`);
  stats.total += users.length;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    for (const user of batch) {
      console.log(`\nProcessing User: ${user.email} (${user._id})`);

      // Skip if already has miniImage
      if (user.miniImage) {
        console.log(`  ⏭️  Already has mini version`);
        stats.skipped++;
        continue;
      }

      const fullUrl = ensureFullUrl(user.image);
      const result = await processImageUrl(fullUrl);

      if (result && !DRY_RUN) {
        await User.updateOne({ _id: user._id }, { $set: { image: result.basePath, miniImage: result.miniPath } });
        console.log(`  ✅ Updated user in database`);
      }
    }
  }
}

/**
 * Migrate Campaign images
 */
async function migrateCampaigns() {
  console.log('\n📢 Migrating Campaign images...');
  const campaigns = await Campaign.find({ image: { $exists: true, $ne: '' } }).lean();
  console.log(`Found ${campaigns.length} campaigns with images`);
  stats.total += campaigns.length;

  for (const campaign of campaigns) {
    console.log(`\nProcessing Campaign: ${campaign.title} (${campaign._id})`);

    // @ts-ignore - miniImage exists in schema
    if (campaign.miniImage) {
      console.log(`  ⏭️  Already has mini version`);
      stats.skipped++;
      continue;
    }

    const fullUrl = ensureFullUrl(campaign.image);
    const result = await processImageUrl(fullUrl);

    if (result && !DRY_RUN) {
      await Campaign.updateOne({ _id: campaign._id }, { $set: { image: result.basePath, miniImage: result.miniPath } });
      console.log(`  ✅ Updated campaign in database`);
    }
  }
}

/**
 * Migrate Banner images
 */
async function migrateBanners() {
  console.log('\n🎯 Migrating Banner images...');
  const banners = await Banner.find({ imageUrl: { $exists: true, $ne: '' } }).lean();
  console.log(`Found ${banners.length} banners with images`);
  stats.total += banners.length;

  for (const banner of banners) {
    console.log(`\nProcessing Banner: ${banner.name} (${banner._id})`);

    // @ts-ignore - miniImageUrl exists in schema
    if (banner.miniImageUrl) {
      console.log(`  ⏭️  Already has mini version`);
      stats.skipped++;
      continue;
    }

    const fullUrl = ensureFullUrl(banner.imageUrl);
    const result = await processImageUrl(fullUrl);

    if (result && !DRY_RUN) {
      await Banner.updateOne(
        { _id: banner._id },
        { $set: { imageUrl: result.basePath, miniImageUrl: result.miniPath } }
      );
      console.log(`  ✅ Updated banner in database`);
    }
  }
}

/**
 * Migrate Category images
 */
async function migrateCategories() {
  console.log('\n📂 Migrating Category images...');
  const categories = await Category.find({ image: { $exists: true, $ne: '' } }).lean();
  console.log(`Found ${categories.length} categories with images`);
  stats.total += categories.length;

  for (const category of categories) {
    console.log(`\nProcessing Category: ${category.name} (${category._id})`);

    // @ts-ignore - miniImage exists in schema
    if (category.miniImage) {
      console.log(`  ⏭️  Already has mini version`);
      stats.skipped++;
      continue;
    }

    // Skip default placeholder images
    if (category.image.includes('isomorphic-furyroad.s3.amazonaws.com')) {
      console.log(`  ⏭️  Skipping placeholder image`);
      stats.skipped++;
      continue;
    }

    const fullUrl = ensureFullUrl(category.image);
    const result = await processImageUrl(fullUrl);

    if (result && !DRY_RUN) {
      await Category.updateOne({ _id: category._id }, { $set: { image: result.basePath, miniImage: result.miniPath } });
      console.log(`  ✅ Updated category in database`);
    }
  }
}

/**
 * Migrate Attribute images (children.image)
 */
async function migrateAttributes() {
  console.log('\n🏷️  Migrating Attribute images...');
  const attributes = await Attribute.find({ 'children.image': { $exists: true } }).lean();
  console.log(`Found ${attributes.length} attributes with child images`);
  stats.total += attributes.length;

  for (const attribute of attributes) {
    if (!attribute.children || attribute.children.length === 0) continue;

    console.log(`\nProcessing Attribute: ${attribute.name} (${attribute._id})`);

    const updatedChildren = [];
    for (const child of attribute.children) {
      if (!child.image) {
        updatedChildren.push(child);
        continue;
      }

      // @ts-ignore - miniImage exists in schema
      if (child.miniImage) {
        console.log(`  ⏭️  Child "${child.name}" already has mini version`);
        updatedChildren.push(child);
        continue;
      }

      const fullUrl = ensureFullUrl(child.image);
      const result = await processImageUrl(fullUrl);

      if (result) {
        updatedChildren.push({
          ...child,
          image: result.basePath,
          miniImage: result.miniPath,
        });
      } else {
        updatedChildren.push(child);
      }
    }

    if (!DRY_RUN && updatedChildren.length > 0) {
      await Attribute.updateOne({ _id: attribute._id }, { $set: { children: updatedChildren } });
      console.log(`  ✅ Updated attribute in database`);
    }
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting image migration to WebP with mini versions\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '✏️  LIVE RUN'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Bunny CDN: ${BUNNY_BASE_URL}`);
  console.log(`MongoDB: ${MONGO_URL}\n`);

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    // Run migrations for each model
    await migrateProducts();
    await migrateUsers();
    await migrateCampaigns();
    await migrateBanners();
    await migrateCategories();
    await migrateAttributes();

    // Print final report
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION REPORT');
    console.log('='.repeat(60));
    console.log(`Total items:     ${stats.total}`);
    console.log(`Processed:       ${stats.processed}`);
    console.log(`Succeeded:       ${stats.succeeded}`);
    console.log(`Failed:          ${stats.failed}`);
    console.log(`Skipped:         ${stats.skipped}`);
    console.log('='.repeat(60));

    if (stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      stats.errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.item}`);
        console.log(`   Error: ${err.error}\n`);
      });
    }

    if (DRY_RUN) {
      console.log('\n🔍 This was a DRY RUN - no actual changes were made');
      console.log('   Run without --dry-run flag to apply changes');
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log('   Old images are kept on Bunny for 30-day rollback period');
      console.log('   You can manually delete them after verification');
    }
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run migration
main();
