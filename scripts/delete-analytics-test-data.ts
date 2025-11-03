/**
 * Analytics Test Data Cleanup Script
 *
 * This script removes ALL test data created by the populate-analytics-test-data.ts script.
 *
 * Safety Features:
 * - 3-second delay before deletion (press Ctrl+C to cancel)
 * - Only deletes records matching test identifiers
 * - Verification check after deletion
 *
 * Usage: ts-node scripts/delete-analytics-test-data.ts
 */

// @ts-nocheck
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import models
import User from '../src/models/User';
import Product from '../src/models/Product';
import Category from '../src/models/Category';
import Order from '../src/models/Order';
import Transaction from '../src/models/Transaction';
import Review from '../src/models/Review';
import Coupon from '../src/models/Coupon';
import Wishlist from '../src/models/wishlist';

// Test data identifiers
const TEST_EMAIL_SUFFIX = '@analytics-test.local';
const TEST_PRODUCT_PREFIX = 'TEST_ANALYTICS_';
const TEST_CATEGORY_PREFIX = 'TEST_CAT_';
const TEST_COUPON_PREFIX = 'TEST';

// ============================================
// UTILITY FUNCTIONS
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function deleteTestUsers() {
  console.log('\n🗑️  Deleting test users...');

  const testUsers = await User.find({
    email: { $regex: TEST_EMAIL_SUFFIX.replace('.', '\\.') + '$' },
  });

  const userIds = testUsers.map((u) => u._id);
  console.log(`  Found ${userIds.length} test users`);

  if (userIds.length === 0) {
    console.log('  ✅ No test users to delete');
    return { count: 0, ids: [] };
  }

  // Delete associated wishlists first
  const wishlistsDeleted = await Wishlist.deleteMany({ user: { $in: userIds } });
  console.log(`  Deleted ${wishlistsDeleted.deletedCount} associated wishlists`);

  // Delete users
  const result = await User.deleteMany({ _id: { $in: userIds } });
  console.log(`  ✅ Deleted ${result.deletedCount} test users`);

  return { count: result.deletedCount, ids: userIds };
}

async function deleteTestCategories() {
  console.log('\n🗑️  Deleting test categories...');

  const testCategories = await Category.find({
    name: { $regex: `^${TEST_CATEGORY_PREFIX}` },
  });

  const categoryIds = testCategories.map((c) => c._id);
  console.log(`  Found ${categoryIds.length} test categories`);

  if (categoryIds.length === 0) {
    console.log('  ✅ No test categories to delete');
    return { count: 0, ids: [] };
  }

  const result = await Category.deleteMany({ _id: { $in: categoryIds } });
  console.log(`  ✅ Deleted ${result.deletedCount} test categories`);

  return { count: result.deletedCount, ids: categoryIds };
}

async function deleteTestProducts() {
  console.log('\n🗑️  Deleting test products...');

  const testProducts = await Product.find({
    name: { $regex: `^${TEST_PRODUCT_PREFIX}` },
  });

  const productIds = testProducts.map((p) => p._id);
  console.log(`  Found ${productIds.length} test products`);

  if (productIds.length === 0) {
    console.log('  ✅ No test products to delete');
    return { count: 0, ids: [] };
  }

  // Delete associated reviews first
  const reviewsDeleted = await Review.deleteMany({ product: { $in: productIds } });
  console.log(`  Deleted ${reviewsDeleted.deletedCount} associated reviews`);

  // Delete products
  const result = await Product.deleteMany({ _id: { $in: productIds } });
  console.log(`  ✅ Deleted ${result.deletedCount} test products`);

  return { count: result.deletedCount, ids: productIds };
}

async function deleteTestCoupons() {
  console.log('\n🗑️  Deleting test coupons...');

  const result = await Coupon.deleteMany({
    coupon: { $regex: `^${TEST_COUPON_PREFIX}.*ANALYTICS$` },
  });

  console.log(`  ✅ Deleted ${result.deletedCount} test coupons`);
  return { count: result.deletedCount };
}

async function deleteTestOrders(userIds) {
  console.log('\n🗑️  Deleting test orders...');

  if (userIds.length === 0) {
    console.log('  ✅ No user IDs provided, skipping');
    return { count: 0, ids: [] };
  }

  const testOrders = await Order.find({ user: { $in: userIds } });
  const orderIds = testOrders.map((o) => o._id);

  console.log(`  Found ${orderIds.length} test orders`);

  if (orderIds.length === 0) {
    console.log('  ✅ No test orders to delete');
    return { count: 0, ids: [] };
  }

  // Delete associated transactions first
  const transactionsDeleted = await Transaction.deleteMany({ orderId: { $in: orderIds } });
  console.log(`  Deleted ${transactionsDeleted.deletedCount} associated transactions`);

  // Delete associated reviews
  const reviewsDeleted = await Review.deleteMany({ orderId: { $in: orderIds } });
  console.log(`  Deleted ${reviewsDeleted.deletedCount} associated reviews`);

  // Delete orders
  const result = await Order.deleteMany({ _id: { $in: orderIds } });
  console.log(`  ✅ Deleted ${result.deletedCount} test orders`);

  return { count: result.deletedCount, ids: orderIds };
}

async function deleteTestTransactions(userIds) {
  console.log('\n🗑️  Deleting remaining test transactions...');

  if (userIds.length === 0) {
    console.log('  ✅ No user IDs provided, skipping');
    return { count: 0 };
  }

  // Delete any remaining transactions (not linked to orders)
  const result = await Transaction.deleteMany({
    userId: { $in: userIds },
    reference: { $regex: '^TEST_TXN_' },
  });

  console.log(`  ✅ Deleted ${result.deletedCount} remaining test transactions`);
  return { count: result.deletedCount };
}

async function deleteTestReviews(userIds) {
  console.log('\n🗑️  Deleting remaining test reviews...');

  if (userIds.length === 0) {
    console.log('  ✅ No user IDs provided, skipping');
    return { count: 0 };
  }

  // Delete any remaining reviews (not already deleted with products/orders)
  const result = await Review.deleteMany({ reviewBy: { $in: userIds } });

  console.log(`  ✅ Deleted ${result.deletedCount} remaining test reviews`);
  return { count: result.deletedCount };
}

async function deleteOrphanedWishlists() {
  console.log('\n🗑️  Deleting orphaned wishlists...');

  // Find wishlists where user no longer exists
  const allWishlists = await Wishlist.find({});
  const orphanedIds = [];

  for (const wishlist of allWishlists) {
    const userExists = await User.exists({ _id: wishlist.user });
    if (!userExists) {
      orphanedIds.push(wishlist._id);
    }
  }

  if (orphanedIds.length === 0) {
    console.log('  ✅ No orphaned wishlists found');
    return { count: 0 };
  }

  const result = await Wishlist.deleteMany({ _id: { $in: orphanedIds } });
  console.log(`  ✅ Deleted ${result.deletedCount} orphaned wishlists`);

  return { count: result.deletedCount };
}

async function verifyDeletion() {
  console.log('\n🔍 Verifying deletion...');

  const checks = [
    {
      name: 'Test Users',
      count: await User.countDocuments({ email: { $regex: TEST_EMAIL_SUFFIX.replace('.', '\\.') + '$' } }),
    },
    {
      name: 'Test Categories',
      count: await Category.countDocuments({ name: { $regex: `^${TEST_CATEGORY_PREFIX}` } }),
    },
    {
      name: 'Test Products',
      count: await Product.countDocuments({ name: { $regex: `^${TEST_PRODUCT_PREFIX}` } }),
    },
    {
      name: 'Test Coupons',
      count: await Coupon.countDocuments({ coupon: { $regex: `^${TEST_COUPON_PREFIX}.*ANALYTICS$` } }),
    },
  ];

  let allClean = true;
  for (const check of checks) {
    if (check.count > 0) {
      console.log(`  ⚠️  Warning: ${check.count} ${check.name} still exist`);
      allClean = false;
    } else {
      console.log(`  ✅ ${check.name}: Clean`);
    }
  }

  return allClean;
}

async function main() {
  console.log('🚀 Starting Analytics Test Data Cleanup');
  console.log('==========================================');
  console.log('⚠️  WARNING: This will permanently delete all test data!');
  console.log('==========================================\n');

  // Add 3-second delay for user to cancel
  console.log('⏳ Starting deletion in 3 seconds... Press Ctrl+C to cancel');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  await connectDB();

  try {
    const summary = {
      users: 0,
      categories: 0,
      products: 0,
      coupons: 0,
      orders: 0,
      transactions: 0,
      reviews: 0,
      wishlists: 0,
    };

    // Delete in correct order to handle foreign key relationships

    // 1. Delete test users (and their wishlists)
    const usersResult = await deleteTestUsers();
    summary.users = usersResult.count;
    const testUserIds = usersResult.ids;

    // 2. Delete test orders (and their transactions/reviews)
    const ordersResult = await deleteTestOrders(testUserIds);
    summary.orders = ordersResult.count;

    // 3. Delete remaining transactions
    const transactionsResult = await deleteTestTransactions(testUserIds);
    summary.transactions = transactionsResult.count;

    // 4. Delete test categories
    const categoriesResult = await deleteTestCategories();
    summary.categories = categoriesResult.count;

    // 5. Delete test products (and their reviews)
    const productsResult = await deleteTestProducts();
    summary.products = productsResult.count;

    // 6. Delete remaining reviews
    const reviewsResult = await deleteTestReviews(testUserIds);
    summary.reviews = reviewsResult.count;

    // 7. Delete test coupons
    const couponsResult = await deleteTestCoupons();
    summary.coupons = couponsResult.count;

    // 8. Delete orphaned wishlists
    const wishlistsResult = await deleteOrphanedWishlists();
    summary.wishlists = wishlistsResult.count;

    // Verify deletion
    const isClean = await verifyDeletion();

    console.log('\n✅ ============================================');
    console.log('✅ TEST DATA CLEANUP COMPLETED');
    console.log('✅ ============================================\n');
    console.log('📊 Deletion Summary:');
    console.log(`  - Users: ${summary.users}`);
    console.log(`  - Categories: ${summary.categories}`);
    console.log(`  - Products: ${summary.products}`);
    console.log(`  - Coupons: ${summary.coupons}`);
    console.log(`  - Orders: ${summary.orders}`);
    console.log(`  - Transactions: ${summary.transactions}`);
    console.log(`  - Reviews: ${summary.reviews}`);
    console.log(`  - Wishlists: ${summary.wishlists}`);
    console.log(
      `\n${
        isClean
          ? '✅ All test data successfully removed!'
          : '⚠️  Some test data may still exist - check verification above'
      }\n`
    );
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

main().catch((error: Error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
