/**
 * Rollback Script: Remove Text Fields from Banners
 * 
 * Removes the text fields added by add-text-fields-to-banners migration:
 * - headerText
 * - mainText
 * - CTA
 * 
 * Usage:
 *   npx ts-node scripts/migrations/rollback-text-fields-from-banners.ts
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
 * Main rollback function
 */
async function rollbackTextFields() {
  try {
    console.log('🔄 Starting rollback: Remove text fields from banners');
    console.log('📡 Connecting to MongoDB...');

    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    // Count banners with text fields
    const withHeader = await Banner.countDocuments({ headerText: { $exists: true } });
    const withMain = await Banner.countDocuments({ mainText: { $exists: true } });
    const withCTA = await Banner.countDocuments({ CTA: { $exists: true } });

    console.log(`📊 Current state:`);
    console.log(`   Banners with headerText: ${withHeader}`);
    console.log(`   Banners with mainText: ${withMain}`);
    console.log(`   Banners with CTA: ${withCTA}\n`);

    if (withHeader === 0 && withMain === 0 && withCTA === 0) {
      console.log('✅ No text fields found. Nothing to rollback.');
      await mongoose.connection.close();
      console.log('👋 Database connection closed.');
      return;
    }

    console.log('⚠️  WARNING: This will permanently remove text fields from all banners!');
    console.log('   - headerText');
    console.log('   - mainText');
    console.log('   - CTA\n');
    console.log('   This action cannot be undone!\n');
    console.log('   Proceeding in 5 seconds... (Press Ctrl+C to cancel)\n');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Perform the rollback
    const result = await Banner.updateMany(
      {},
      {
        $unset: {
          headerText: '',
          mainText: '',
          CTA: '',
        },
      }
    );

    console.log('═══════════════════════════════════════');
    console.log('📊 ROLLBACK RESULTS');
    console.log('═══════════════════════════════════════');
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);
    console.log(`Acknowledged: ${result.acknowledged}`);

    // Verify the rollback
    console.log('\n🔍 Verifying rollback...\n');

    const verifyHeader = await Banner.countDocuments({ headerText: { $exists: true } });
    const verifyMain = await Banner.countDocuments({ mainText: { $exists: true } });
    const verifyCTA = await Banner.countDocuments({ CTA: { $exists: true } });

    console.log(`Banners with headerText: ${verifyHeader}`);
    console.log(`Banners with mainText: ${verifyMain}`);
    console.log(`Banners with CTA: ${verifyCTA}`);

    if (verifyHeader === 0 && verifyMain === 0 && verifyCTA === 0) {
      console.log('\n✅ Rollback verified successfully!');
      console.log('   All text fields have been removed from banners.');
    } else {
      console.log('\n⚠️  Warning: Some banners may still have text fields.');
      console.log('   Please check the database manually.');
    }

    // Show sample of banners after rollback
    console.log('\n📋 Sample of banners after rollback:');
    const samples = await Banner.find()
      .select('name imageUrl pageLink category')
      .limit(3);

    samples.forEach((banner, index) => {
      console.log(`\n   ${index + 1}. ${banner.name} (Category: ${(banner as any).category})`);
      console.log(`      Image: ${(banner as any).imageUrl}`);
      console.log(`      Link: ${(banner as any).pageLink}`);
    });

    console.log('\n═══════════════════════════════════════');
    console.log('✅ Rollback completed successfully!');
    console.log('═══════════════════════════════════════');

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
  } catch (error) {
    console.error('\n❌ Rollback failed with error:');
    console.error(error);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('👋 Database connection closed.');
    }

    process.exit(1);
  }
}

// Run the rollback
rollbackTextFields();
