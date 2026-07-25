/**
 * Rollback Script: Remove supportingText and ctaColor from Banners
 *
 * Removes the fields added by add-supporting-text-and-cta-color-to-banners:
 * - supportingText
 * - ctaColor
 *
 * Usage:
 *   npx ts-node scripts/migrations/rollback-supporting-text-and-cta-color-from-banners.ts
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
async function rollbackSupportingTextAndCtaColor() {
  try {
    console.log('🔄 Starting rollback: Remove supportingText and ctaColor from banners');
    console.log('📡 Connecting to MongoDB...');

    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    const withSupportingText = await Banner.countDocuments({ supportingText: { $exists: true } });
    const withCtaColor = await Banner.countDocuments({ ctaColor: { $exists: true } });

    console.log(`📊 Current state:`);
    console.log(`   Banners with supportingText: ${withSupportingText}`);
    console.log(`   Banners with ctaColor: ${withCtaColor}\n`);

    if (withSupportingText === 0 && withCtaColor === 0) {
      console.log('✅ Neither field found. Nothing to rollback.');
      await mongoose.connection.close();
      console.log('👋 Database connection closed.');
      return;
    }

    console.log('⚠️  WARNING: This will permanently remove these fields from all banners!');
    console.log('   - supportingText');
    console.log('   - ctaColor\n');
    console.log('   This action cannot be undone!\n');
    console.log('   Proceeding in 5 seconds... (Press Ctrl+C to cancel)\n');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const result = await Banner.updateMany(
      {},
      {
        $unset: {
          supportingText: '',
          ctaColor: '',
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

    const verifySupportingText = await Banner.countDocuments({ supportingText: { $exists: true } });
    const verifyCtaColor = await Banner.countDocuments({ ctaColor: { $exists: true } });

    console.log(`Banners with supportingText: ${verifySupportingText}`);
    console.log(`Banners with ctaColor: ${verifyCtaColor}`);

    if (verifySupportingText === 0 && verifyCtaColor === 0) {
      console.log('\n✅ Rollback verified successfully!');
      console.log('   Both fields have been removed from banners.');
    } else {
      console.log('\n⚠️  Warning: Some banners may still have these fields.');
      console.log('   Please check the database manually.');
    }

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
rollbackSupportingTextAndCtaColor();
