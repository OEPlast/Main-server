/**
 * Verification Script: Check priority field status
 * 
 * This script checks the current state of the priority field across all categories.
 * Use this before or after running migrations to verify the database state.
 * 
 * Usage:
 *   npx ts-node scripts/migrations/verify-priority-field.ts
 * 
 * What it does:
 *   1. Connects to MongoDB
 *   2. Counts categories with and without priority field
 *   3. Shows breakdown of priority values (true/false)
 *   4. Displays sample categories
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
 * Verification function
 */
async function verifyPriorityField() {
  try {
    console.log('🔍 Starting verification: Check priority field status');
    console.log('📡 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    // Total categories
    const totalCategories = await Category.countDocuments();
    console.log('📊 DATABASE OVERVIEW');
    console.log('═══════════════════════════════════════');
    console.log(`Total categories: ${totalCategories}`);

    // Categories with priority field
    const withPriority = await Category.countDocuments({
      priority: { $exists: true },
    });
    
    // Categories without priority field
    const withoutPriority = await Category.countDocuments({
      priority: { $exists: false },
    });

    console.log(`Categories WITH priority field: ${withPriority} (${((withPriority / totalCategories) * 100).toFixed(1)}%)`);
    console.log(`Categories WITHOUT priority field: ${withoutPriority} (${((withoutPriority / totalCategories) * 100).toFixed(1)}%)`);

    // Priority breakdown
    if (withPriority > 0) {
      const priorityTrue = await Category.countDocuments({ priority: true });
      const priorityFalse = await Category.countDocuments({ priority: false });

      console.log('\n📈 PRIORITY BREAKDOWN');
      console.log('═══════════════════════════════════════');
      console.log(`Priority = true:  ${priorityTrue} (${((priorityTrue / withPriority) * 100).toFixed(1)}% of categories with field)`);
      console.log(`Priority = false: ${priorityFalse} (${((priorityFalse / withPriority) * 100).toFixed(1)}% of categories with field)`);

      // Show priority categories
      if (priorityTrue > 0) {
        const priorityCategories = await Category.find({ priority: true })
          .select('name slug priority')
          .limit(10);

        console.log('\n⭐ PRIORITY CATEGORIES (max 10):');
        console.log('═══════════════════════════════════════');
        priorityCategories.forEach((cat, index) => {
          console.log(`   ${index + 1}. ${cat.name} (${cat.slug})`);
        });
      }

      // Show non-priority categories sample
      if (priorityFalse > 0) {
        const normalCategories = await Category.find({ priority: false })
          .select('name slug priority')
          .limit(5);

        console.log('\n📋 REGULAR CATEGORIES (sample 5):');
        console.log('═══════════════════════════════════════');
        normalCategories.forEach((cat, index) => {
          console.log(`   ${index + 1}. ${cat.name} (${cat.slug})`);
        });
      }
    }

    // Categories missing the field
    if (withoutPriority > 0) {
      const missingFieldCategories = await Category.find({
        priority: { $exists: false },
      })
        .select('name slug')
        .limit(5);

      console.log('\n❌ CATEGORIES MISSING PRIORITY FIELD (sample 5):');
      console.log('═══════════════════════════════════════');
      missingFieldCategories.forEach((cat, index) => {
        console.log(`   ${index + 1}. ${cat.name} (${cat.slug})`);
      });
      console.log(`\n💡 TIP: Run add-priority-to-categories.ts to add the field to ${withoutPriority} categories`);
    }

    // Migration status
    console.log('\n🎯 MIGRATION STATUS');
    console.log('═══════════════════════════════════════');
    if (withoutPriority === 0) {
      console.log('✅ All categories have the priority field');
      console.log('✅ Migration is complete');
    } else {
      console.log('⚠️  Some categories are missing the priority field');
      console.log('⚠️  Migration needed');
      console.log(`   Run: npx ts-node scripts/migrations/add-priority-to-categories.ts`);
    }

    // Close database connection
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
    console.log('✨ Verification completed!');

  } catch (error) {
    console.error('\n❌ Verification failed with error:');
    console.error(error);
    
    // Close connection on error
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('👋 Database connection closed.');
    }
    
    process.exit(1);
  }
}

// Run the verification
verifyPriorityField();
