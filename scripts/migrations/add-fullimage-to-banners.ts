/**
 * Migration Script: Add fullImage field to existing banners
 * 
 * This script adds the fullImage boolean field to all existing banner documents.
 * Default value: true
 * 
 * Run with: npx ts-node scripts/migrations/add-fullimage-to-banners.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function addFullImageToBanners() {
  try {
    console.log('\n🚀 Banner fullImage Field Migration');
    console.log('=====================================\n');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Banner = mongoose.model('Banner', new mongoose.Schema({}, { strict: false }));

    // Check existing banners
    const totalBanners = await Banner.countDocuments();
    console.log(`📊 Total banners in database: ${totalBanners}\n`);

    if (totalBanners === 0) {
      console.log('⚠️  No banners found in database. Nothing to migrate.');
      await mongoose.connection.close();
      return;
    }

    // Check how many already have fullImage field
    const bannersWithFullImage = await Banner.countDocuments({ fullImage: { $exists: true } });
    const bannersToUpdate = totalBanners - bannersWithFullImage;

    console.log(`📋 Banners already with fullImage field: ${bannersWithFullImage}`);
    console.log(`📋 Banners to be updated: ${bannersToUpdate}\n`);

    if (bannersToUpdate === 0) {
      console.log('✅ All banners already have the fullImage field. No migration needed.');
      await mongoose.connection.close();
      return;
    }

    // Warning and countdown
    console.log('⚠️  WARNING: This will update ALL banner documents without fullImage field.');
    console.log('⚠️  Starting in 5 seconds... Press Ctrl+C to cancel.\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Add fullImage field to banners that don't have it
    const result = await Banner.updateMany(
      { fullImage: { $exists: false } },
      { $set: { fullImage: true } }
    );

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Migration Summary:');
    console.log(`- Total banners in database: ${totalBanners}`);
    console.log(`- Banners updated: ${result.modifiedCount}`);
    console.log(`- Banners already had field: ${bannersWithFullImage}\n`);

    // Verify the migration
    const verifyCount = await Banner.countDocuments({ fullImage: { $exists: true } });
    console.log('✅ Verification:');
    console.log(`- Banners with fullImage field: ${verifyCount}/${totalBanners}\n`);

    // Show sample documents
    const samples = await Banner.find().limit(3).select('name fullImage active category');
    console.log('📋 Sample updated documents (first 3):');
    samples.forEach((banner: any, index) => {
      console.log(`\n${index + 1}. ${banner.name}`);
      console.log(`   - fullImage: ${banner.fullImage}`);
      console.log(`   - active: ${banner.active}`);
      console.log(`   - category: ${banner.category}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('💡 All banners now have fullImage field set to true (default).\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.\n');
  }
}

// Run migration
addFullImageToBanners();
