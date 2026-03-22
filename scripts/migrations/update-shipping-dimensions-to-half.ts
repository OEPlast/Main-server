/**
 * Migration Script: Update all product shipping dimensions to 0.5
 *
 * Sets weight, height, width, and length to 0.5 for ALL products.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/migrations/update-shipping-dimensions-to-half.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Product from '../../src/models/Product';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI or DATABASE_URL not found in environment variables');
  process.exit(1);
}

const NEW_VALUES = {
  height: 0.3,
  width: 0.4,
  length: 0.4,
};

async function migrate() {
  try {
    console.log('🚀 Starting migration: Update all product shipping dimensions to 0.5');
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);

    console.log('⚙️  Updating ALL products with new dimensions...');
    console.log(`   New values:  ${NEW_VALUES.length}x${NEW_VALUES.width}x${NEW_VALUES.height}cm`);

    const result = await Product.updateMany({}, { $set: NEW_VALUES });

    console.log(`✅ Migration completed successfully!`);
    console.log(`   - Matched: ${result.matchedCount} documents`);
    console.log(`   - Modified: ${result.modifiedCount} documents`);

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

migrate();
