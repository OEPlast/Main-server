/**
 * Migration Script: Add Text Fields to Banners
 * 
 * Adds three new required fields to existing banners:
 * - headerText: string (required)
 * - mainText: string (required)
 * - CTA: string (required, defaults to '#')
 * 
 * Usage:
 *   npx ts-node scripts/migrations/add-text-fields-to-banners.ts
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
async function migrateTextFields() {
  try {
    console.log('🔄 Starting migration: Add text fields to banners');
    console.log('📡 Connecting to MongoDB...');

    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    // Find banners missing the new fields
    const bannersToUpdate = await Banner.find({
      $or: [
        { headerText: { $exists: false } },
        { mainText: { $exists: false } },
        { CTA: { $exists: false } },
      ],
    });

    console.log(`📊 Found ${bannersToUpdate.length} banners to update\n`);

    if (bannersToUpdate.length === 0) {
      console.log('✅ No banners need updating. All banners already have text fields.');
      await mongoose.connection.close();
      console.log('👋 Database connection closed.');
      return;
    }

    console.log('⚠️  WARNING: This will update existing banners with default values:');
    console.log('   - headerText: "Banner Title" (placeholder)');
    console.log('   - mainText: "Banner description text" (placeholder)');
    console.log('   - CTA: "#" (default)\n');
    console.log('   You should update these values via the admin panel after migration.\n');
    console.log('   Proceeding in 5 seconds... (Press Ctrl+C to cancel)\n');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Perform the migration
    const result = await Banner.updateMany(
      {
        $or: [
          { headerText: { $exists: false } },
          { mainText: { $exists: false } },
          { CTA: { $exists: false } },
        ],
      },
      {
        $set: {
          headerText: 'Banner Title',
          mainText: 'Banner description text',
          CTA: '#',
        },
      }
    );

    console.log('═══════════════════════════════════════');
    console.log('📊 MIGRATION RESULTS');
    console.log('═══════════════════════════════════════');
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);
    console.log(`Acknowledged: ${result.acknowledged}`);

    // Verify the migration
    console.log('\n🔍 Verifying migration...\n');

    const verifyAll = await Banner.countDocuments();
    const verifyWithHeader = await Banner.countDocuments({ headerText: { $exists: true } });
    const verifyWithMain = await Banner.countDocuments({ mainText: { $exists: true } });
    const verifyWithCTA = await Banner.countDocuments({ CTA: { $exists: true } });

    console.log(`Total banners: ${verifyAll}`);
    console.log(`Banners with headerText: ${verifyWithHeader}`);
    console.log(`Banners with mainText: ${verifyWithMain}`);
    console.log(`Banners with CTA: ${verifyWithCTA}`);

    if (verifyAll === verifyWithHeader && verifyAll === verifyWithMain && verifyAll === verifyWithCTA) {
      console.log('\n✅ Migration verified successfully!');
      console.log('   All banners now have the required text fields.');
    } else {
      console.log('\n⚠️  Warning: Some banners may still be missing fields.');
      console.log('   Please check the database manually.');
    }

    // Show sample of migrated banners
    console.log('\n📋 Sample of migrated banners:');
    const samples = await Banner.find()
      .select('name headerText mainText CTA category')
      .limit(3);

    samples.forEach((banner, index) => {
      console.log(`\n   ${index + 1}. ${banner.name} (Category: ${banner.category})`);
      console.log(`      Header: ${banner.headerText}`);
      console.log(`      Main: ${banner.mainText}`);
      console.log(`      CTA: ${banner.CTA}`);
    });

    console.log('\n═══════════════════════════════════════');
    console.log('✅ Migration completed successfully!');
    console.log('═══════════════════════════════════════\n');

    console.log('💡 Next steps:');
    console.log('   1. Review banners in admin panel');
    console.log('   2. Update placeholder text with actual content');
    console.log('   3. Test banner display on storefront');

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
migrateTextFields();
