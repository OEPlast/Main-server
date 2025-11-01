/**
 * Cleanup Test Data Script
 * 
 * Removes all test data created by seed-test-data.ts
 * 
 * Usage: npx ts-node scripts/cleanup-test-data.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import models
import Product from '../src/models/Product';
import Order from '../src/models/Order';
import Transaction from '../src/models/Transaction';
import Coupon from '../src/models/Coupon';
import User from '../src/models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oeplast';

const testCouponCodes = [
  'WELCOME10',
  'SAVE20',
  'BULK25',
  'FLAT500',
  'FLAT1000',
  'FLAT2000',
  'FIRST15',
  'MEGA30',
  'VIP35',
  'SPECIAL5K',
  'NEWYEAR20',
  'CLEARANCE40',
];

async function cleanupTestData() {
  try {
    console.log('🧹 Starting Test Data Cleanup...\n');
    console.log('=' .repeat(60));

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('=' .repeat(60) + '\n');

    // ============================================
    // Delete test coupons
    // ============================================
    console.log('🎟️  Deleting test coupons...');
    const deletedCoupons = await Coupon.deleteMany({
      coupon: { $in: testCouponCodes },
    });
    console.log(`✅ Deleted ${deletedCoupons.deletedCount} coupons\n`);

    // ============================================
    // Delete test products (SKU >= 10000)
    // ============================================
    console.log('📦 Deleting test products...');
    
    // First, get product IDs to delete related orders
    const testProducts = await Product.find({ sku: { $gte: 10000 } }).select('_id');
    const testProductIds = testProducts.map((p) => p._id);
    
    const deletedProducts = await Product.deleteMany({ sku: { $gte: 10000 } });
    console.log(`✅ Deleted ${deletedProducts.deletedCount} products\n`);

    // ============================================
    // Delete orders containing test products
    // ============================================
    console.log('🛒 Deleting orders with test products...');
    
    const ordersWithTestProducts = await Order.find({
      'products.product': { $in: testProductIds },
    }).select('_id transactionId');

    const orderIds = ordersWithTestProducts.map((o) => o._id);
    const transactionIds = ordersWithTestProducts
      .map((o) => o.transactionId)
      .filter((id) => id != null);

    const deletedOrders = await Order.deleteMany({
      _id: { $in: orderIds },
    });
    console.log(`✅ Deleted ${deletedOrders.deletedCount} orders\n`);

    // ============================================
    // Delete related transactions
    // ============================================
    console.log('💳 Deleting related transactions...');
    const deletedTransactions = await Transaction.deleteMany({
      _id: { $in: transactionIds },
    });
    console.log(`✅ Deleted ${deletedTransactions.deletedCount} transactions\n`);

    // ============================================
    // Delete test users
    // ============================================
    console.log('👤 Deleting test users...');
    const deletedUsers = await User.deleteMany({
      email: { $regex: /^testuser\d+@oeplast\.com$/ },
    });
    console.log(`✅ Deleted ${deletedUsers.deletedCount} test users\n`);

    // ============================================
    // Summary
    // ============================================
    console.log('=' .repeat(60));
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    console.log('\n🗑️  Deleted:');
    console.log(`   - ${deletedCoupons.deletedCount} coupons`);
    console.log(`   - ${deletedProducts.deletedCount} products`);
    console.log(`   - ${deletedOrders.deletedCount} orders`);
    console.log(`   - ${deletedTransactions.deletedCount} transactions`);
    console.log(`   - ${deletedUsers.deletedCount} test users`);
    console.log();

  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  }
}

// ============================================
// RUN SCRIPT
// ============================================

cleanupTestData()
  .then(() => {
    console.log('✅ Cleanup script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup script failed:', error);
    process.exit(1);
  });
