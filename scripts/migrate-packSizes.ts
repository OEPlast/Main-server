/**
 * Migration Script: Add packSizes field to products
 * 
 * This script adds the optional packSizes field to all existing products.
 * 
 * Pack sizes allow products to be sold in different quantities (e.g., Single, Bag of 10, Carton of 50)
 * with optional custom pricing, stock, and attribute selection control.
 * 
 * Strategy:
 * - All existing products will have packSizes = undefined (optional field)
 * - No default packs are created automatically
 * - Products can function normally without pack sizes
 * - Admins can manually add pack sizes as needed
 * 
 * Run this script once after deploying the packSizes feature.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-packSizes.ts
 */

import mongoose from 'mongoose';
import Product from '../src/models/Product';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/oeplast';

async function migratePackSizes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('📦 Starting packSizes field migration...\n');

    // Count products without packSizes field
    const productsWithoutField = await Product.countDocuments({
      packSizes: { $exists: false }
    });

    console.log(`📊 Found ${productsWithoutField} products without packSizes field\n`);

    if (productsWithoutField === 0) {
      console.log('✨ All products already have packSizes field (or none exist)!');
      await mongoose.disconnect();
      return;
    }

    console.log('🔄 Adding packSizes field to products...');
    console.log('  Strategy: Set packSizes as undefined (optional field)\n');

    // Add packSizes field as undefined (optional)
    // This allows the field to exist in the schema without forcing a default value
    const result = await Product.updateMany(
      { packSizes: { $exists: false } },
      { $set: { packSizes: undefined } }
    );

    console.log(`  ✓ Products updated: ${result.modifiedCount}`);

    console.log('\n📈 Migration Summary:');
    console.log(`  ✅ Total products processed: ${result.modifiedCount}`);
    console.log(`  📦 packSizes field is now available for all products`);
    console.log(`  ℹ️  Products without packs will use base price/stock`);

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const totalProducts = await Product.countDocuments();
    const productsWithPackSizes = await Product.countDocuments({
      packSizes: { $exists: true, $ne: null, $not: { $size: 0 } }
    });

    console.log(`  📊 Total products: ${totalProducts}`);
    console.log(`  📦 Products with pack sizes defined: ${productsWithPackSizes}`);
    console.log(`  📄 Products without pack sizes: ${totalProducts - productsWithPackSizes}`);

    // Show example of how to add pack sizes manually
    console.log('\n💡 Example: Adding pack sizes to a product');
    console.log('-------------------------------------------');
    console.log('db.products.updateOne(');
    console.log('  { _id: ObjectId("your-product-id") },');
    console.log('  {');
    console.log('    $set: {');
    console.log('      packSizes: [');
    console.log('        {');
    console.log('          label: "Single",');
    console.log('          quantity: 1,');
    console.log('          enableAttributes: true  // Allow color/material selection');
    console.log('        },');
    console.log('        {');
    console.log('          label: "Bag of 10",');
    console.log('          quantity: 10,');
    console.log('          price: 4500,  // Optional: custom price');
    console.log('          stock: 50,    // Optional: separate stock tracking');
    console.log('          enableAttributes: false  // Pre-packaged, no attribute selection');
    console.log('        },');
    console.log('        {');
    console.log('          label: "Carton of 50",');
    console.log('          quantity: 50,');
    console.log('          price: 20000,');
    console.log('          stock: 10,');
    console.log('          enableAttributes: false');
    console.log('        }');
    console.log('      ]');
    console.log('    }');
    console.log('  }');
    console.log(');\n');

    console.log('✨ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Pack sizes are now available in the product schema');
    console.log('  2. No automatic packs were created (products work as before)');
    console.log('  3. Use admin dashboard to add pack sizes to products as needed');
    console.log('  4. When no packs are defined, product uses base price/stock');
    console.log('  5. Test pack size selection in storefront for products with packs');

    console.log('\n🔑 Key behaviors:');
    console.log('  • effectivePrice = pack.price ?? (product.price * pack.quantity)');
    console.log('  • effectiveStock = pack.stock ?? product.stock');
    console.log('  • enableAttributes controls whether users can select color/material/etc.');

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
  migratePackSizes()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export default migratePackSizes;
