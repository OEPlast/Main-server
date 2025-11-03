/**
 * Analytics Test Data Population Script
 *
 * Populates comprehensive test data for analytics across 6 years (2019-2025)
 * with intentional gaps to test edge cases:
 * - 2021-2022: No data (full year gaps)
 * - June 1 - July 20, 2025: No data (mid-year gap)
 *
 * Usage: ts-node scripts/populate-analytics-test-data.ts
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

// Test data markers
const TEST_EMAIL_SUFFIX = '@analytics-test.local';
const TEST_PRODUCT_PREFIX = 'TEST_ANALYTICS_';
const TEST_CATEGORY_PREFIX = 'TEST_CAT_';

// Date ranges (excluding gaps)
const DATA_PERIODS = [
  { start: new Date('2019-01-01'), end: new Date('2020-12-31') }, // 2019-2020: Full data
  // 2021-2022: NO DATA (gap for testing)
  { start: new Date('2023-01-01'), end: new Date('2025-05-31') }, // 2023 - May 2025
  // June 1 - July 20, 2025: NO DATA (gap for testing)
  { start: new Date('2025-07-21'), end: new Date('2025-10-27') }, // July 21 - Today
];

// Sample data templates
const PAYMENT_METHODS = ['paystack', 'cash_on_delivery']; // Only Paystack and Cash payments
const ORDER_STATUSES = ['pending', 'processing', 'completed', 'cancelled', 'failed'];
const TRANSACTION_STATUSES = ['pending', 'completed', 'failed', 'cancelled'];
const COUNTRIES = ['Nigeria']; // Only Nigeria
const STATES_NIGERIA = [
  'Lagos',
  'Abuja',
  'Rivers',
  'Kano',
  'Oyo',
  'Delta',
  'Ogun',
  'Kaduna',
  'Edo',
  'Anambra',
  'Enugu',
  'Imo',
  'Plateau',
  'Akwa Ibom',
  'Ondo',
  'Osun',
  'Cross River',
  'Abia',
  'Kwara',
  'Benue',
  'Bauchi',
  'Taraba',
  'Adamawa',
  'Borno',
];
const LGAS_BY_STATE = {
  Lagos: [
    'Ikeja',
    'Surulere',
    'Lekki',
    'Victoria Island',
    'Ikorodu',
    'Badagry',
    'Epe',
    'Alimosho',
    'Oshodi-Isolo',
    'Agege',
  ],
  Abuja: ['Gwagwalada', 'Kuje', 'Abaji', 'Kwali', 'Bwari', 'Garki', 'Maitama', 'Asokoro', 'Wuse', 'Jabi'],
  Rivers: ['Port Harcourt', 'Obio-Akpor', 'Eleme', 'Okrika', 'Ikwerre', 'Bonny', 'Degema', 'Ogu-Bolo'],
  Kano: ['Kano Municipal', 'Nassarawa', 'Fagge', 'Dala', 'Gwale', 'Tarauni', 'Kumbotso', 'Ungogo'],
  Oyo: ['Ibadan North', 'Ibadan South-West', 'Akinyele', 'Lagelu', 'Ido', 'Egbeda', 'Ogbomosho'],
  Delta: ['Warri South', 'Uvwie', 'Sapele', 'Oshimili', 'Ethiope East', 'Udu', 'Okpe'],
};

// Helper: Generate random date within period
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper: Random element from array
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper: Random number between min and max
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Random price
function randomPrice(min = 5000, max = 500000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Check if date is in gap period
function isInGapPeriod(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Check 2021-2022 gap
  if (year === 2021 || year === 2022) return true;

  // Check June 1 - July 20, 2025 gap
  if (year === 2025) {
    if (month === 5) return true; // June (0-indexed)
    if (month === 6 && day <= 20) return true; // July 1-20
  }

  return false;
}

let testUsers = [];
let testCategories = [];
let testProducts = [];
let testCoupons = [];

async function connectDB() {
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

async function createTestUsers(count = 300) {
  console.log(`\n📝 Creating ${count} test users...`);
  const users = [];

  for (let i = 0; i < count; i++) {
    const joinDate = randomDate(DATA_PERIODS[0].start, new Date());
    if (isInGapPeriod(joinDate)) continue;

    const country = 'Nigeria'; // All users from Nigeria
    const state = randomElement(STATES_NIGERIA);
    const lgas = LGAS_BY_STATE[state] || ['Central'];
    const city = randomElement(lgas);

    const firstName = `TestUser${i}`;
    const lastName = `Analytics${i}`;

    users.push({
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email: `testuser${i}${TEST_EMAIL_SUFFIX}`,
      password: '$2b$10$testpasswordhash', // Dummy hash
      emailVerified: joinDate, // Should be Date, not boolean
      phoneNumber: `+234${randomInt(7000000000, 8999999999)}`,
      address: [
        {
          firstName,
          lastName,
          phoneNumber: `+234${randomInt(7000000000, 8999999999)}`,
          address1: `${randomInt(1, 500)} ${randomElement([
            'Allen Avenue',
            'Victoria Street',
            'Ahmadu Bello Way',
            'Awolowo Road',
            'Herbert Macaulay Way',
          ])}`,
          address2: `${randomElement(['Flat', 'Suite', 'Apartment'])} ${randomInt(1, 50)}`,
          city,
          zipCode: `${randomInt(100000, 999999)}`,
          state,
          country,
          active: true,
        },
      ],
      country,
      createdAt: joinDate,
      updatedAt: joinDate,
    });
  }

  const created = await User.insertMany(users);
  testUsers = created;
  console.log(`✅ Created ${created.length} test users`);
}

async function createTestCategories(count = 20) {
  console.log(`\n📝 Creating ${count} test categories...`);
  const categories = [];

  const categoryNames = [
    'Electronics',
    'Fashion',
    'Home & Garden',
    'Sports',
    'Books',
    'Toys',
    'Beauty',
    'Automotive',
    'Health',
    'Food',
    'Furniture',
    'Music',
    'Pet Supplies',
    'Office',
    'Tools',
    'Jewelry',
    'Baby',
    'Outdoor',
    'Gaming',
    'Art',
  ];

  for (let i = 0; i < count; i++) {
    const categoryName = `${TEST_CATEGORY_PREFIX}${categoryNames[i] || `Category${i}`}`;
    categories.push({
      name: categoryName,
      slug: categoryName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and'),
      description: `Test analytics category ${i}`,
      image: `https://via.placeholder.com/300?text=Category${i}`,
      banner: '',
      parent: [],
      createdAt: DATA_PERIODS[0].start,
    });
  }

  const created = await Category.insertMany(categories);
  testCategories = created;
  console.log(`✅ Created ${created.length} test categories`);
}

async function createTestProducts(count = 150) {
  console.log(`\n📝 Creating ${count} test products...`);
  const products = [];

  for (let i = 0; i < count; i++) {
    const createdDate = randomDate(DATA_PERIODS[0].start, new Date());
    if (isInGapPeriod(createdDate)) continue;

    const price = randomPrice(5000, 500000);
    const category = randomElement(testCategories); // Ensure every product has a category

    products.push({
      sku: 10000000 + i, // Unique SKU starting from 10000000
      name: `${TEST_PRODUCT_PREFIX}Product_${i}`,
      description: `Test analytics product ${i} from ${category.name}`,
      category: category._id, // Always assign a category
      tags: [],
      description_images: [
        {
          url: `https://via.placeholder.com/500?text=Product${i}`,
          cover_image: true,
        },
      ],
      specifications: [],
      dimension: [],
      shipping: {
        addedCost: randomInt(500, 5000),
        increaseCostBy: 0,
        addedDays: randomInt(1, 5),
      },
      attributes: [],
      pricingTiers: undefined,
      stock: randomInt(5, 1000), // Use 'stock' not 'quantity'
      lowStockThreshold: 5,
      status: 'active', // Make products active
      price,
      slug: `test-product-${i}`,
      createdAt: createdDate,
      updatedAt: createdDate,
    });
  }

  const created = await Product.insertMany(products);
  testProducts = created;
  console.log(`✅ Created ${created.length} test products`);
}

async function createTestCoupons(count = 50) {
  console.log(`\n📝 Creating ${count} test coupons...`);
  const coupons = [];

  // Use first test user as creator
  const creator = testUsers[0]._id;

  for (let i = 0; i < count; i++) {
    const startDate = randomDate(DATA_PERIODS[0].start, new Date());
    if (isInGapPeriod(startDate)) continue;

    const discountType = Math.random() > 0.5 ? 'percentage' : 'fixed';
    const endDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

    coupons.push({
      coupon: `TEST${i}ANALYTICS`, // Field is called 'coupon' not 'code'
      discount: discountType === 'percentage' ? randomInt(5, 50) : randomInt(1000, 50000),
      discountType,
      creator, // Required field
      appliesTo: {
        scope: 'order',
        productIds: [],
        categoryIds: [],
      },
      startDate,
      endDate,
      maxUsage: randomInt(50, 500),
      timesUsed: 0,
      minOrderValue: randomInt(10000, 100000),
      active: true,
      stackable: false,
      couponType: 'normal',
      usedBy: [],
      createdAt: startDate,
    });
  }

  const created = await Coupon.insertMany(coupons);
  testCoupons = created;
  console.log(`✅ Created ${created.length} test coupons`);
}

async function createTestOrders(count = 1000) {
  console.log(`\n📝 Creating ${count} test orders with transactions...`);
  let ordersCreated = 0;
  let transactionsCreated = 0;

  // Valid order statuses from schema (increase completed orders)
  const validStatuses = ['Pending', 'Processing', 'Cancelled', 'Completed', 'Completed', 'Completed', 'Completed'];

  for (let i = 0; i < count; i++) {
    // Randomly select a data period, then generate a date within it
    const period = randomElement(DATA_PERIODS);
    const orderDate = randomDate(period.start, period.end);
    if (isInGapPeriod(orderDate)) continue;

    const user = randomElement(testUsers); // Different users for different orders
    const status = randomElement(validStatuses);
    const paymentMethod = randomElement(PAYMENT_METHODS); // Only 'paystack' or 'cash'

    // Random products (1-5 items)
    const itemCount = randomInt(1, 5);
    const products = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = randomElement(testProducts);
      const qty = randomInt(1, 3);
      const price = product.price;
      products.push({
        product: product._id,
        qty,
        price,
        attributes: [],
      });
      subtotal += price * qty;
    }

    const shippingPrice = randomInt(500, 5000);
    const taxPrice = Math.round(subtotal * 0.075);
    let totalBeforeDiscount = subtotal + shippingPrice + taxPrice;
    let total = totalBeforeDiscount;
    let couponDiscount = 0;

    // Apply coupon more frequently (60% chance - increased from 30%)
    let couponApplied = null;
    let couponSnapshot = undefined;
    if (Math.random() > 0.4 && testCoupons.length > 0) {
      const coupon = randomElement(testCoupons);
      couponApplied = coupon._id;
      couponSnapshot = {
        discount: coupon.discount,
        discountType: coupon.discountType,
        appliesTo: coupon.appliesTo,
      };

      if (coupon.discountType === 'percentage') {
        couponDiscount = Math.round(subtotal * (coupon.discount / 100));
      } else {
        couponDiscount = Math.min(coupon.discount, subtotal);
      }

      total = totalBeforeDiscount - couponDiscount;

      // Update coupon usage
      await Coupon.findByIdAndUpdate(coupon._id, { $inc: { timesUsed: 1 } });
    }

    // Create order
    const userAddress = user.address[0];
    const order = await Order.create({
      user: user._id,
      products,
      shippingAddress: {
        firstName: userAddress.firstName,
        lastName: userAddress.lastName,
        phoneNumber: userAddress.phoneNumber,
        address1: userAddress.address1,
        address2: userAddress.address2 || '',
        city: userAddress.city,
        state: userAddress.state,
        country: userAddress.country,
        zipCode: userAddress.zipCode,
      },
      paymentMethod,
      paymentResult: {
        id: `test_payment_${i}`,
        status: status === 'Completed' ? 'success' : 'pending',
        email: user.email,
      },
      coupon: couponApplied,
      couponSnapshot,
      couponDiscount,
      total, // Required field
      totalBeforeDiscount,
      shippingPrice,
      taxPrice,
      deliveryType: 'shipping',
      status,
      isPaid: status === 'Completed',
      paidAt: status === 'Completed' ? orderDate : undefined,
      deliveredAt: status === 'Completed' ? new Date(orderDate.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
      createdAt: orderDate,
      updatedAt: orderDate,
    });
    ordersCreated++;

    // Create corresponding transaction
    const transactionStatus = status === 'Completed' ? 'completed' : status === 'Cancelled' ? 'cancelled' : 'pending';

    await Transaction.create({
      orderId: order._id,
      userId: user._id,
      transactionType: 'order_payment',
      reference: `TEST_TXN_${i}_${Date.now()}`,
      amount: total,
      currency: 'NGN',
      paymentMethod,
      paymentGateway: paymentMethod === 'paystack' ? 'paystack' : 'manual', // Only paystack or manual (cash)
      status: transactionStatus,
      paymentDate: orderDate,
      paidAt: status === 'Completed' ? orderDate : undefined,
      gatewayResponse: {
        responseMessage: `Test transaction ${i}`,
      },
      refunds: [],
      fees:
        paymentMethod === 'paystack'
          ? {
              gatewayFee: total * 0.015,
              processingFee: 100,
              totalFees: total * 0.015 + 100,
            }
          : {
              gatewayFee: 0,
              processingFee: 0,
              totalFees: 0,
            },
      customerInfo: {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      },
      createdAt: orderDate,
      updatedAt: orderDate,
    });
    transactionsCreated++;

    if ((i + 1) % 100 === 0) {
      console.log(`  Progress: ${i + 1}/${count} orders processed...`);
    }
  }

  console.log(`✅ Created ${ordersCreated} test orders`);
  console.log(`✅ Created ${transactionsCreated} test transactions`);
}

async function createTestReviews(count = 800) {
  console.log(`\n📝 Creating ${count} test reviews...`);
  let reviewsCreated = 0;
  const reviewedPairs = new Set(); // Track product-user pairs to avoid duplicates

  // Get completed orders for verified purchase reviews (note: status is 'Completed' with capital C)
  const completedOrders = await Order.find({
    status: 'Completed',
    user: { $in: testUsers.map((u) => u._id) },
  }).limit(count);

  console.log(`  Found ${completedOrders.length} completed orders for reviews...`);

  for (const order of completedOrders) {
    const reviewDate = new Date(order.createdAt.getTime() + randomInt(1, 14) * 24 * 60 * 60 * 1000);
    if (isInGapPeriod(reviewDate)) continue;

    // Review random product from order (if available)
    const orderProduct = randomElement(order.products);
    if (!orderProduct) continue;

    // Check if this product-user pair has already been reviewed
    const pairKey = `${orderProduct.product.toString()}-${order.user.toString()}`;
    if (reviewedPairs.has(pairKey)) continue;

    // Get a transaction for this order
    const transaction = await Transaction.findOne({ orderId: order._id });
    if (!transaction) continue;

    const rating = randomInt(1, 5);
    const reviewTexts = {
      1: 'Very poor quality. Not satisfied at all with this product.',
      2: 'Below expectations. Could be much better for the price.',
      3: 'Average product. Nothing special but works as expected.',
      4: 'Good product. Satisfied with purchase and quality.',
      5: 'Excellent! Highly recommended! Great value for money.',
    };

    try {
      await Review.create({
        product: orderProduct.product,
        reviewBy: order.user,
        rating,
        review: reviewTexts[rating] || 'Test review content with sufficient length',
        title: `Test Review ${reviewsCreated}`,
        transactionId: transaction._id,
        orderId: order._id,
        helpfulVotes: { helpful: [], notHelpful: [] },
        likes: [],
        replies: [],
        createdAt: reviewDate,
        updatedAt: reviewDate,
      });

      reviewedPairs.add(pairKey);
      reviewsCreated++;

      if (reviewsCreated % 100 === 0) {
        console.log(`  Progress: ${reviewsCreated}/${completedOrders.length} reviews created...`);
      }
    } catch (err) {
      // Skip duplicate key errors
      if (err.code !== 11000) throw err;
    }
  }

  console.log(`✅ Created ${reviewsCreated} test reviews`);
}

async function createTestWishlists(count = 500) {
  console.log(`\n📝 Creating ${count} test wishlist entries...`);
  let wishlistsCreated = 0;
  const wishlistEntries = [];

  for (let i = 0; i < count; i++) {
    const wishlistDate = randomDate(DATA_PERIODS[0].start, new Date());
    if (isInGapPeriod(wishlistDate)) continue;

    const user = randomElement(testUsers); // Different users wishlisting products
    const product = randomElement(testProducts);

    // Check if this user-product pair already exists in our batch
    const exists = wishlistEntries.some(
      (w) => w.user.toString() === user._id.toString() && w.product.toString() === product._id.toString()
    );

    if (!exists) {
      wishlistEntries.push({
        user: user._id,
        product: product._id,
        createdAt: wishlistDate,
        updatedAt: wishlistDate,
      });
    }
  }

  if (wishlistEntries.length > 0) {
    try {
      await Wishlist.insertMany(wishlistEntries, { ordered: false });
      wishlistsCreated = wishlistEntries.length;
    } catch (err) {
      // Ignore duplicate key errors
      if (err.code === 11000) {
        wishlistsCreated = wishlistEntries.length - (err.writeErrors?.length || 0);
      } else {
        throw err;
      }
    }
  }

  console.log(`✅ Created ${wishlistsCreated} test wishlist entries`);
}

async function main() {
  console.log('🚀 Starting Analytics Test Data Population');
  console.log('==========================================');
  console.log('📅 Data periods:');
  console.log('  - 2019-2020: Full data');
  console.log('  - 2021-2022: NO DATA (gap)');
  console.log('  - 2023 - May 2025: Full data');
  console.log('  - June 1 - July 20, 2025: NO DATA (gap)');
  console.log('  - July 21 - Today: Full data');
  console.log('==========================================\n');

  await connectDB();

  try {
    // Create base data
    await createTestUsers(300);
    await createTestCategories(20);
    await createTestProducts(150);
    await createTestCoupons(50);

    // Create transactional data
    await createTestOrders(1000);
    await createTestReviews(800);
    await createTestWishlists(500);

    console.log('\n✅ ============================================');
    console.log('✅ TEST DATA POPULATION COMPLETED SUCCESSFULLY');
    console.log('✅ ============================================\n');
    console.log('📊 Summary:');
    console.log(`  - Users: ${testUsers.length} (All from Nigeria)`);
    console.log(`  - Categories: ${testCategories.length}`);
    console.log(`  - Products: ${testProducts.length} (All categorized)`);
    console.log(`  - Coupons: ${testCoupons.length}`);
    console.log(`  - Orders: ~1000 (excluding gap periods, ~60% with coupons)`);
    console.log(`  - Transactions: ~1000 (Paystack & Cash only)`);
    console.log(`  - Reviews: ~800 (excluding gap periods)`);
    console.log(`  - Wishlist entries: ~500 (excluding gap periods)`);
    console.log('\n💡 Notes:');
    console.log('  - All users are from Nigerian states and LGAs');
    console.log('  - Payment methods: Paystack and Cash only');
    console.log('  - All products have assigned categories');
    console.log('  - ~60% of orders use coupons (increased from 30%)');
    console.log('  - Actual counts may be lower due to gap period filtering\n');
  } catch (error) {
    console.error('❌ Error populating test data:', error);
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
