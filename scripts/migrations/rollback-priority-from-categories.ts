/**
 * Rollback Script: Remove priority field from all categories
 * 
 * This script removes the 'priority' field from all categories in the database.
 * Use this if you need to rollback the add-priority-to-categories migration.
 * 
 * Usage:
 *   npx ts-node scripts/migrations/rollback-priority-from-categories.ts
 * 
 * What it does:
 *   1. Connects to MongoDB
 *   2. Finds all categories with a 'priority' field
 *   3. Removes the priority field using $unset
 *   4. Reports the number of documents updated
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Category from '../../src/models/Category';

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
async function rollbackPriorityField() {
  try {
    console.log('🔄 Starting rollback: Remove priority field from categories');
    console.log('📡 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    // Count total categories
    const totalCategories = await Category.countDocuments();
    console.log(`📊 Total categories in database: ${totalCategories}`);

    // Find categories with the priority field
    const categoriesWithPriority = await Category.countDocuments({
      priority: { $exists: true },
    });
    console.log(`🔍 Categories with priority field: ${categoriesWithPriority}`);

    if (categoriesWithPriority === 0) {
      console.log('✨ No categories have the priority field. Nothing to rollback.');
      await mongoose.connection.close();
      console.log('👋 Rollback completed. Database connection closed.');
      return;
    }

    // Show sample before rollback
    const sampleBefore = await Category.find({ priority: { $exists: true } })
      .select('name slug priority')
      .limit(5);
    
    if (sampleBefore.length > 0) {
      console.log('\n📋 Sample of categories before rollback:');
      sampleBefore.forEach((cat, index) => {
        console.log(`   ${index + 1}. ${cat.name} (${cat.slug}) - priority: ${cat.priority}`);
      });
    }

    // Confirm before proceeding
    console.log('\n⚠️  WARNING: This will remove the priority field from all categories!');
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds to proceed...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Remove priority field from all categories
    console.log('⚙️  Removing priority field...');
    const result = await Category.updateMany(
      { priority: { $exists: true } },
      { $unset: { priority: '' } }
    );

    console.log(`✅ Rollback completed successfully!`);
    console.log(`   - Matched: ${result.matchedCount} documents`);
    console.log(`   - Modified: ${result.modifiedCount} documents`);

    // Verify the rollback
    const categoriesStillWithPriority = await Category.countDocuments({
      priority: { $exists: true },
    });
    console.log(`✓ Verification: ${categoriesStillWithPriority} categories still have the priority field`);

    if (categoriesStillWithPriority === 0) {
      console.log('✓ All priority fields successfully removed');
    }

    // Close database connection
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
    console.log('🎉 Rollback script finished successfully!');

  } catch (error) {
    console.error('\n❌ Rollback failed with error:');
    console.error(error);
    
    // Close connection on error
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('👋 Database connection closed.');
    }
    
    process.exit(1);
  }
}

// Run the rollback
rollbackPriorityField();
