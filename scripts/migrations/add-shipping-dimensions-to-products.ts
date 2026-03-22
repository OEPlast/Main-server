/**
 * Migration Script: Add GIG shipping dimension fields to all products
 *
 * Adds weight, height, width, length, isVolumetric to all existing products
 * that don't already have these fields.
 *
 * Usage:
 *   npx ts-node scripts/migrations/add-shipping-dimensions-to-products.ts
 *
 * Rollback:
 *   npx ts-node scripts/migrations/add-shipping-dimensions-to-products.ts --rollback
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

const DEFAULTS = {
  weight: 1,
  height: 10,
  width: 10,
  length: 10,
  isVolumetric: false,
};

async function migrate() {
  try {
    console.log('🚀 Starting migration: Add shipping dimensions to products');
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);

    const productsWithoutFields = await Product.countDocuments({
      weight: { $exists: false },
    });
    console.log(`🔍 Products without shipping dimensions: ${productsWithoutFields}`);

    if (productsWithoutFields === 0) {
      console.log('✨ All products already have shipping dimensions. Nothing to update.');
      await mongoose.connection.close();
      return;
    }

    console.log('⚙️  Updating products with default shipping dimensions...');
    console.log(
      `   Defaults: weight=${DEFAULTS.weight}kg, ${DEFAULTS.length}x${DEFAULTS.width}x${DEFAULTS.height}cm, isVolumetric=${DEFAULTS.isVolumetric}`
    );

    const result = await Product.updateMany({ weight: { $exists: false } }, { $set: DEFAULTS });

    console.log(`✅ Migration completed successfully!`);
    console.log(`   - Matched: ${result.matchedCount} documents`);
    console.log(`   - Modified: ${result.modifiedCount} documents`);

    // Verify
    const productsWithFields = await Product.countDocuments({
      weight: { $exists: true },
      height: { $exists: true },
      width: { $exists: true },
      length: { $exists: true },
      isVolumetric: { $exists: true },
    });
    console.log(`✓ Verification: ${productsWithFields}/${totalProducts} products now have shipping dimensions`);

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
    console.log('🎉 Migration script finished successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed with error:');
    console.error(error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

async function rollback() {
  try {
    console.log('🔄 Starting rollback: Remove shipping dimensions from products');
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    const result = await Product.updateMany(
      { weight: { $exists: true } },
      { $unset: { weight: '', height: '', width: '', length: '', isVolumetric: '' } }
    );

    console.log(`✅ Rollback completed successfully!`);
    console.log(`   - Matched: ${result.matchedCount} documents`);
    console.log(`   - Modified: ${result.modifiedCount} documents`);

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
  } catch (error) {
    console.error('\n❌ Rollback failed with error:');
    console.error(error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

const isRollback = process.argv.includes('--rollback');

if (isRollback) {
  rollback();
} else {
  migrate();
}
