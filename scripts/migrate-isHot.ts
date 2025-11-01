/**
 * Migration Script: Add isHot field to all Sales
 * 
 * This script adds the isHot field to all existing sales in the database.
 * 
 * Strategy:
 * - Flash sales → isHot: true (aggressive marketing for time-sensitive sales)
 * - Limited/Normal sales → isHot: false (default, can be manually enabled)
 * 
 * Run this script once after deploying the isHot feature.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-isHot.ts
 */

import mongoose from 'mongoose';
import Sales from '../src/models/Sales';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oeplast';

async function migrateIsHot() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔥 Starting isHot field migration...\n');

    // Count sales without isHot field
    const salesNeedingUpdate = await Sales.countDocuments({
      isHot: { $exists: false }
    });

    console.log(`📊 Found ${salesNeedingUpdate} sales without isHot field\n`);

    if (salesNeedingUpdate === 0) {
      console.log('✨ All sales already have isHot field!');
      await mongoose.disconnect();
      return;
    }

    console.log('🔄 Applying migration strategy...');
    console.log('  Strategy: Flash sales → hot, Limited/Normal → normal\n');

    // Strategy 1: Mark Flash sales as hot (aggressive marketing for time-sensitive sales)
    const flashResult = await Sales.updateMany(
      { 
        type: 'Flash',
        isHot: { $exists: false }
      },
      { $set: { isHot: true } }
    );

    console.log(`  ✓ Flash sales marked as hot: ${flashResult.modifiedCount}`);

    // Strategy 2: Mark Limited and Normal sales as normal (can be manually changed)
    const limitedResult = await Sales.updateMany(
      { 
        type: 'Limited',
        isHot: { $exists: false }
      },
      { $set: { isHot: false } }
    );

    console.log(`  ✓ Limited sales marked as normal: ${limitedResult.modifiedCount}`);

    const normalResult = await Sales.updateMany(
      { 
        type: 'Normal',
        isHot: { $exists: false }
      },
      { $set: { isHot: false } }
    );

    console.log(`  ✓ Normal sales marked as normal: ${normalResult.modifiedCount}`);

    // Handle any sales without a type (edge case)
    const unknownResult = await Sales.updateMany(
      { 
        type: { $exists: false },
        isHot: { $exists: false }
      },
      { $set: { isHot: false } }
    );

    if (unknownResult.modifiedCount > 0) {
      console.log(`  ⚠️  Sales without type marked as normal: ${unknownResult.modifiedCount}`);
    }

    console.log('\n📈 Migration Summary:');
    const totalModified = flashResult.modifiedCount + limitedResult.modifiedCount + 
                          normalResult.modifiedCount + unknownResult.modifiedCount;
    console.log(`  ✅ Total sales updated: ${totalModified}`);
    console.log(`     - Hot sales (Flash): ${flashResult.modifiedCount}`);
    console.log(`     - Normal sales (Limited): ${limitedResult.modifiedCount}`);
    console.log(`     - Normal sales (Normal): ${normalResult.modifiedCount}`);
    if (unknownResult.modifiedCount > 0) {
      console.log(`     - Normal sales (Unknown type): ${unknownResult.modifiedCount}`);
    }

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const remainingSales = await Sales.countDocuments({
      isHot: { $exists: false }
    });

    if (remainingSales === 0) {
      console.log('  ✅ All sales now have isHot field!');
    } else {
      console.log(`  ⚠️  Warning: ${remainingSales} sales still missing isHot field`);
    }

    // Show distribution
    const hotCount = await Sales.countDocuments({ isHot: true });
    const normalCount = await Sales.countDocuments({ isHot: false });
    const totalCount = await Sales.countDocuments();

    console.log('\n📊 Current Distribution:');
    console.log(`  🔥 Hot sales: ${hotCount} (${Math.round((hotCount / totalCount) * 100)}%)`);
    console.log(`  📦 Normal sales: ${normalCount} (${Math.round((normalCount / totalCount) * 100)}%)`);
    console.log(`  📈 Total sales: ${totalCount}`);

    // Show samples
    console.log('\n📋 Sample of updated sales:');
    const hotSamples = await Sales.find({ isHot: true })
      .select('title type isHot isActive')
      .limit(3);
    
    const normalSamples = await Sales.find({ isHot: false })
      .select('title type isHot isActive')
      .limit(3);

    console.log('\n  Hot Sales:');
    hotSamples.forEach((sale) => {
      console.log(`    🔥 ${sale.title || 'Untitled'} (${sale.type}) - ${sale.isActive ? 'Active' : 'Inactive'}`);
    });

    console.log('\n  Normal Sales:');
    normalSamples.forEach((sale) => {
      console.log(`    📦 ${sale.title || 'Untitled'} (${sale.type}) - ${sale.isActive ? 'Active' : 'Inactive'}`);
    });

    console.log('\n✨ Migration completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('  1. Review the hot/normal distribution above');
    console.log('  2. Manually adjust isHot for specific sales in admin dashboard');
    console.log('  3. Test storefront to verify marquee and progress display');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  migrateIsHot()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export default migrateIsHot;
