/**
 * Migration Script: Add supportingText and ctaColor to Banners
 *
 * Backfills two new fields on existing banner documents:
 * - supportingText: string | null (optional, defaults to null)
 * - ctaColor: string (defaults to '#000000')
 *
 * Usage:
 *   npx ts-node scripts/migrations/add-supporting-text-and-cta-color-to-banners.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Banner from '../../src/models/Banner';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI or DATABASE_URL not found in environment variables');
  process.exit(1);
}

/**
 * Main migration function
 */
async function migrateSupportingTextAndCtaColor() {
  try {
    console.log('🔄 Starting migration: Add supportingText and ctaColor to banners');
    console.log('📡 Connecting to MongoDB...');

    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    // Find banners missing the new fields
    const bannersToUpdate = await Banner.find({
      $or: [{ supportingText: { $exists: false } }, { ctaColor: { $exists: false } }],
    });

    console.log(`📊 Found ${bannersToUpdate.length} banners to update\n`);

    if (bannersToUpdate.length === 0) {
      console.log('✅ No banners need updating. All banners already have these fields.');
      await mongoose.connection.close();
      console.log('👋 Database connection closed.');
      return;
    }

    console.log('⚠️  This will update existing banners with default values:');
    console.log('   - supportingText: null (falls back to "Sale! Up To 50% Off!" on the storefront)');
    console.log('   - ctaColor: "#000000" (matches the previous hardcoded CTA button color)\n');
    console.log('   Proceeding in 5 seconds... (Press Ctrl+C to cancel)\n');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Perform the migration — only set fields that are actually missing on each document
    const supportingTextResult = await Banner.updateMany(
      { supportingText: { $exists: false } },
      { $set: { supportingText: null } }
    );

    const ctaColorResult = await Banner.updateMany(
      { ctaColor: { $exists: false } },
      { $set: { ctaColor: '#000000' } }
    );

    console.log('═══════════════════════════════════════');
    console.log('📊 MIGRATION RESULTS');
    console.log('═══════════════════════════════════════');
    console.log(`supportingText — matched: ${supportingTextResult.matchedCount}, modified: ${supportingTextResult.modifiedCount}`);
    console.log(`ctaColor — matched: ${ctaColorResult.matchedCount}, modified: ${ctaColorResult.modifiedCount}`);

    // Verify the migration
    console.log('\n🔍 Verifying migration...\n');

    const verifyAll = await Banner.countDocuments();
    const verifyWithSupportingText = await Banner.countDocuments({ supportingText: { $exists: true } });
    const verifyWithCtaColor = await Banner.countDocuments({ ctaColor: { $exists: true } });

    console.log(`Total banners: ${verifyAll}`);
    console.log(`Banners with supportingText: ${verifyWithSupportingText}`);
    console.log(`Banners with ctaColor: ${verifyWithCtaColor}`);

    if (verifyAll === verifyWithSupportingText && verifyAll === verifyWithCtaColor) {
      console.log('\n✅ Migration verified successfully!');
      console.log('   All banners now have the supportingText and ctaColor fields.');
    } else {
      console.log('\n⚠️  Warning: Some banners may still be missing fields.');
      console.log('   Please check the database manually.');
    }

    // Show sample of migrated banners
    console.log('\n📋 Sample of migrated banners:');
    const samples = await Banner.find().select('name supportingText ctaColor category').limit(3);

    samples.forEach((banner, index) => {
      console.log(`\n   ${index + 1}. ${banner.name} (Category: ${banner.category})`);
      console.log(`      Supporting text: ${banner.supportingText === null ? 'null' : banner.supportingText}`);
      console.log(`      CTA color: ${banner.ctaColor}`);
    });

    console.log('\n═══════════════════════════════════════');
    console.log('✅ Migration completed successfully!');
    console.log('═══════════════════════════════════════\n');

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
  } catch (error) {
    console.error('\n❌ Migration failed with error:');
    console.error(error);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('👋 Database connection closed.');
    }

    process.exit(1);
  }
}

// Run the migration
migrateSupportingTextAndCtaColor();
