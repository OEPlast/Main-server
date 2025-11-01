/**
 * Migration Script: Set originStock and populate boughtCount for sale variants
 * 
 * This script:
 * 1. Updates all products to have an originStock field equal to their current stock
 * 2. Populates boughtCount for sale variants with varied percentages:
 *    - 10% of products: 90% of maxBuys
 *    - 40% of products: 50% of maxBuys
 *    - 50% of products: 10% of maxBuys
 * 
 * Run this script once after deploying the originStock and sales features.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-origin-stock.ts
 */

import mongoose from 'mongoose';
import Product from '../src/models/Product';
import Sales from '../src/models/Sales';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oeplast';

/**
 * Get a random percentage tier for boughtCount
 * - 10% get 90% of maxBuys
 * - 40% get 50% of maxBuys
 * - 50% get 10% of maxBuys
 */
function getBoughtCountPercentage(): number {
  const rand = Math.random();
  if (rand < 0.1) return 0.9; // 10% of sales get 90% bought
  if (rand < 0.5) return 0.5; // 40% of sales get 50% bought
  return 0.1; // 50% of sales get 10% bought
}

async function migrateOriginStock() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all products that don't have originStock or have it set to 0
    const productsToUpdate = await Product.find({
      $or: [
        { originStock: { $exists: false } },
        { originStock: 0 }
      ]
    }).select('_id name stock originStock');

    console.log(`📊 Found ${productsToUpdate.length} products to update\n`);

    if (productsToUpdate.length === 0) {
      console.log('✨ All products already have originStock set!');
      await mongoose.disconnect();
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ productId: string; name: string; error: string }> = [];

    console.log('🔄 Starting migration...\n');

    // Update products in batches for better performance
    const batchSize = 100;
    for (let i = 0; i < productsToUpdate.length; i += batchSize) {
      const batch = productsToUpdate.slice(i, i + batchSize);
      
      const bulkOps = batch.map((product) => ({
        updateOne: {
          filter: { _id: product._id },
          update: { 
            $set: { 
              originStock: product.stock || 0 
            } 
          }
        }
      }));

      try {
        const result = await Product.bulkWrite(bulkOps);
        successCount += result.modifiedCount;
        
        // Log progress every 100 products
        if ((i + batchSize) % 100 === 0 || i + batchSize >= productsToUpdate.length) {
          console.log(`  ✓ Processed ${Math.min(i + batchSize, productsToUpdate.length)}/${productsToUpdate.length} products...`);
        }
      } catch (error) {
        errorCount += batch.length;
        batch.forEach((product) => {
          errors.push({
            productId: product._id.toString(),
            name: product.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`  ✅ Successfully updated: ${successCount} products`);
    console.log(`  ❌ Failed: ${errorCount} products`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach(({ productId, name, error }) => {
        console.log(`  - Product "${name}" (${productId}): ${error}`);
      });
    }

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const remainingProducts = await Product.countDocuments({
      $or: [
        { originStock: { $exists: false } },
        { originStock: null }
      ]
    });

    if (remainingProducts === 0) {
      console.log('  ✅ All products now have originStock set!');
    } else {
      console.log(`  ⚠️  Warning: ${remainingProducts} products still missing originStock`);
    }

    // Show some sample results
    console.log('\n📋 Sample of updated products:');
    const samples = await Product.find({ 
      originStock: { $gt: 0 } 
    })
      .select('name stock originStock')
      .limit(5);
    
    samples.forEach((product) => {
      console.log(`  - ${product.name}: stock=${product.stock}, originStock=${product.originStock}`);
    });

    console.log('\n✨ Origin stock migration completed successfully!');

    // Now migrate sale variants boughtCount
    console.log('\n' + '='.repeat(80));
    console.log('🎯 Step 2: Populating boughtCount for sale variants\n');

    const activeSales = await Sales.find({ 
      deleted: { $ne: true },
      variants: { $exists: true, $ne: [] }
    }).populate('product');

    console.log(`📊 Found ${activeSales.length} sales with variants to update\n`);

    if (activeSales.length === 0) {
      console.log('✨ No sales found to update!');
      await mongoose.disconnect();
      return;
    }

    let salesSuccessCount = 0;
    let salesErrorCount = 0;
    const salesErrors: Array<{ saleId: string; title: string; error: string }> = [];

    console.log('🔄 Starting sales migration...\n');

    for (const sale of activeSales) {
      try {
        // Get percentage tier for this sale
        const percentage = getBoughtCountPercentage();
        
        // Update each variant's boughtCount
        const updatedVariants = sale.variants.map((variant) => {
          const maxBuys = variant.maxBuys || 0;
          const boughtCount = maxBuys > 0 ? Math.floor(maxBuys * percentage) : 0;
          
          return {
            ...variant.toObject(),
            boughtCount
          };
        });

        // Update the sale
        await Sales.findByIdAndUpdate(sale._id, {
          $set: { variants: updatedVariants }
        });

        salesSuccessCount++;
        
        // Log progress every 50 sales
        if (salesSuccessCount % 50 === 0) {
          console.log(`  ✓ Processed ${salesSuccessCount}/${activeSales.length} sales...`);
        }
      } catch (error) {
        salesErrorCount++;
        salesErrors.push({
          saleId: sale._id.toString(),
          title: sale.title || 'Untitled Sale',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('\n📈 Sales Migration Summary:');
    console.log(`  ✅ Successfully updated: ${salesSuccessCount} sales`);
    console.log(`  ❌ Failed: ${salesErrorCount} sales`);
    
    if (salesErrors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      salesErrors.forEach(({ saleId, title, error }) => {
        console.log(`  - Sale "${title}" (${saleId}): ${error}`);
      });
    }

    // Show distribution of boughtCount
    console.log('\n📋 Sample of updated sales:');
    const sampleSales = await Sales.find({ 
      deleted: { $ne: true },
      variants: { $exists: true, $ne: [] }
    })
      .populate('product')
      .limit(10);
    
    sampleSales.forEach((sale) => {
      const totalMaxBuys = sale.variants.reduce((sum, v) => sum + (v.maxBuys || 0), 0);
      const totalBought = sale.variants.reduce((sum, v) => sum + (v.boughtCount || 0), 0);
      const percentage = totalMaxBuys > 0 ? ((totalBought / totalMaxBuys) * 100).toFixed(1) : '0';
      
      console.log(`  - ${sale.title || 'Untitled'}: ${totalBought}/${totalMaxBuys} bought (${percentage}%)`);
    });

    console.log('\n✨ All migrations completed successfully!');

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
  migrateOriginStock()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export default migrateOriginStock;
