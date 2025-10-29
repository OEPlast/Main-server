/**
 * Migration Script: Add priority field to all categories
 * 
 * This script adds a 'priority' field (boolean, default: false) to all existing categories
 * in the database that don't already have this field.
 * 
 * Usage:
 *   npx ts-node scripts/migrations/add-priority-to-categories.ts
 * 
 * What it does:
 *   1. Connects to MongoDB
 *   2. Finds all categories without a 'priority' field
 *   3. Updates them with priority: false
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
 * Main migration function
 */
async function migratePriorityField() {
  try {
    console.log('🚀 Starting migration: Add priority field to categories');
    console.log('📡 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    // Count total categories
    const totalCategories = await Category.countDocuments();
    console.log(`📊 Total categories in database: ${totalCategories}`);

    // Find categories without the priority field
    const categoriesWithoutPriority = await Category.countDocuments({
      priority: { $exists: false },
    });
    console.log(`🔍 Categories without priority field: ${categoriesWithoutPriority}`);

    if (categoriesWithoutPriority === 0) {
      console.log('✨ All categories already have the priority field. Nothing to update.');
      await mongoose.connection.close();
      console.log('👋 Migration completed. Database connection closed.');
      return;
    }

    // Update all categories without priority field
    console.log('⚙️  Updating categories...');
    const result = await Category.updateMany(
      { priority: { $exists: false } },
      { $set: { priority: false } }
    );

    console.log(`✅ Migration completed successfully!`);
    console.log(`   - Matched: ${result.matchedCount} documents`);
    console.log(`   - Modified: ${result.modifiedCount} documents`);

    // Verify the update
    const categoriesWithPriority = await Category.countDocuments({
      priority: { $exists: true },
    });
    console.log(`✓ Verification: ${categoriesWithPriority} categories now have the priority field`);

    // Show sample of updated documents
    const sampleCategories = await Category.find({ priority: false })
      .select('name slug priority')
      .limit(5);
    
    if (sampleCategories.length > 0) {
      console.log('\n📋 Sample of updated categories:');
      sampleCategories.forEach((cat, index) => {
        console.log(`   ${index + 1}. ${cat.name} (${cat.slug}) - priority: ${cat.priority}`);
      });
    }

    // Close database connection
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
    console.log('🎉 Migration script finished successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed with error:');
    console.error(error);
    
    // Close connection on error
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('👋 Database connection closed.');
    }
    
    process.exit(1);
  }
}

// Run the migration
migratePriorityField();
