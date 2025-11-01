/**
 * Test Data Seeding Script for OEPlast Wholesale Plastics Store
 * 
 * Generates:
 * - 12 Coupons (various types)
 * - 40 Products (distributed across existing categories)
 * - 100 Orders (with various statuses)
 * - Corresponding Transactions (success, pending, failed)
 * 
 * Usage: npx ts-node scripts/seed-test-data.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import models
import Product from '../src/models/Product';
import Category from '../src/models/Category';
import Order from '../src/models/Order';
import Transaction from '../src/models/Transaction';
import Coupon from '../src/models/Coupon';
import User from '../src/models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oeplast';

// ============================================
// HELPER FUNCTIONS
// ============================================

// Product images to shuffle between
const productImages = [
  'general/cb559b69-0f8b-4550-a42f-a856e917fb5e-1761179891642-547058260.png',
  'products/bucket1.jpeg',
  'products/bucket2.jpeg',
  'products/bags2.jpeg',
  'products/bags1.jpeg',
];

const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomPrice = (): number => {
  return randomInt(1000, 20000);
};

const randomPick = <T>(array: T[], count: number = 1): T[] => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
};

const randomDate = (daysBack: number = 180): Date => {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
};

const pickWeightedStatus = (options: Array<{ status: string; weight: number }>): string => {
  const total = options.reduce((sum, opt) => sum + opt.weight, 0);
  let random = Math.random() * total;

  for (const option of options) {
    if (random < option.weight) {
      return option.status;
    }
    random -= option.weight;
  }
  return options[0].status;
};

// ============================================
// DATA TEMPLATES
// ============================================

const productNamesByCategory: Record<string, string[]> = {
  'Household Items': [
    'Heavy Duty Plastic Bucket 10L',
    'Large Plastic Basin 45cm',
    'Medium Plastic Basin 35cm',
    'Small Plastic Basin 25cm',
    'Laundry Basket with Handles',
    'Waste Bin 20L with Lid',
    'Waste Bin 50L Industrial',
    'Dust Pan and Brush Set',
    'Plastic Hanger Set (12pcs)',
    'Heavy Duty Clothesline Pegs',
  ],
  'Kitchen & Dining': [
    'Airtight Food Storage Container Set',
    'Plastic Dinner Plates Set (6pcs)',
    'Plastic Cups Set (12pcs)',
    'Water Bottle 1L BPA-Free',
    'Water Bottle 2L Family Size',
    'Insulated Lunch Box',
    'Thermos Food Flask 1.5L',
    'Plastic Cutlery Set (24pcs)',
    'Kitchen Drawer Organizer',
    'Stackable Spice Container Set',
  ],
  'Storage & Organization': [
    'Clear Storage Box 50L',
    'Heavy Duty Storage Box 100L',
    'Under Bed Storage with Wheels',
    'Hanging Wardrobe Organizer',
    'Plastic Shoe Rack 3-Tier',
    'Multi-Purpose 4-Layer Rack',
    'Plastic 5-Drawer Unit',
    'Woven Storage Basket Set',
    'Professional Tool Box',
    'Desktop Document Organizer',
  ],
  'Child Care': [
    'Baby Bath Tub with Support',
    'Baby Feeding Bowl Set',
    'Ergonomic Baby Potty Chair',
    'Colorful Kids Step Stool',
    'Large Toy Storage Box',
    'Odor-Sealing Diaper Pail',
    'Spill-Proof Training Cup Set',
    'Kids Character Plate Set',
  ],
  'Schools & Education': [
    'Student Lunch Box Compartments',
    'Sports Water Bottle 500ml',
    'Large Capacity Pencil Case',
    'Adjustable Book Reading Stand',
    'Student Desk Organizer',
    'A4 Document Holder Box',
    'Geometry Ruler Set',
    'Art Supply Storage Box',
  ],
  'Bathroom Essentials': [
    'Non-Slip Soap Dish',
    'Wall-Mount Toothbrush Holder',
    'Bathroom Storage Basket',
    'Corner Shower Caddy',
    'Toilet Brush with Holder Set',
  ],
};

// Admin user ID for creator field
const ADMIN_USER_ID = '68f46b82c51512575fb07c36';

const couponTemplates = [
  { coupon: 'WELCOME10', discountType: 'percentage' as const, discount: 10, notes: 'Welcome discount for new customers' },
  { coupon: 'SAVE20', discountType: 'percentage' as const, discount: 20, notes: 'Save 20% on all orders' },
  { coupon: 'BULK25', discountType: 'percentage' as const, discount: 25, notes: 'Bulk purchase discount' },
  { coupon: 'FLAT500', discountType: 'fixed' as const, discount: 500, notes: 'Flat ₦500 off' },
  { coupon: 'FLAT1000', discountType: 'fixed' as const, discount: 1000, notes: 'Flat ₦1000 off' },
  { coupon: 'FLAT2000', discountType: 'fixed' as const, discount: 2000, notes: 'Flat ₦2000 off' },
  { coupon: 'FIRST15', discountType: 'percentage' as const, discount: 15, notes: 'First order discount' },
  { coupon: 'MEGA30', discountType: 'percentage' as const, discount: 30, notes: 'Mega sale discount' },
  { coupon: 'VIP35', discountType: 'percentage' as const, discount: 35, notes: 'VIP customer discount' },
  { coupon: 'SPECIAL5K', discountType: 'fixed' as const, discount: 5000, notes: 'Special ₦5000 discount' },
  { coupon: 'NEWYEAR20', discountType: 'percentage' as const, discount: 20, notes: 'New Year sale' },
  { coupon: 'CLEARANCE40', discountType: 'percentage' as const, discount: 40, notes: 'Clearance sale' },
];

const nigerianLocations = [
  { city: 'Lagos', state: 'Lagos' },
  { city: 'Ikeja', state: 'Lagos' },
  { city: 'Lekki', state: 'Lagos' },
  { city: 'Ibadan', state: 'Oyo' },
  { city: 'Kano', state: 'Kano' },
  { city: 'Port Harcourt', state: 'Rivers' },
  { city: 'Abuja', state: 'FCT' },
  { city: 'Enugu', state: 'Enugu' },
  { city: 'Kaduna', state: 'Kaduna' },
  { city: 'Benin City', state: 'Edo' },
  { city: 'Warri', state: 'Delta' },
  { city: 'Aba', state: 'Abia' },
  { city: 'Ilorin', state: 'Kwara' },
  { city: 'Jos', state: 'Plateau' },
  { city: 'Calabar', state: 'Cross River' },
];

const firstNames = ['Adebayo', 'Chioma', 'Emeka', 'Fatima', 'Ibrahim', 'Ngozi', 'Oluwaseun', 'Blessing', 'Chukwuma', 'Aisha'];
const lastNames = ['Okafor', 'Mohammed', 'Williams', 'Adeyemi', 'Nwosu', 'Ibrahim', 'Eze', 'Bello', 'Ogunleye', 'Musa'];

const paymentMethods = ['paystack', 'flutterwave', 'bank_transfer'];

const orderStatusWeights = [
  { status: 'Completed', weight: 65 }, // 65% completed & delivered
  { status: 'Processing', weight: 20 }, // 20% processing
  { status: 'Pending', weight: 10 }, // 10% pending
  { status: 'Cancelled', weight: 5 }, // 5% cancelled
];

const transactionStatusWeights = [
  { status: 'completed', weight: 70 }, // 70% completed
  { status: 'pending', weight: 15 }, // 15% pending
  { status: 'failed', weight: 15 }, // 15% failed
];

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function seedTestData() {
  try {
    console.log('🌱 Starting OEPlast Test Data Seed...\n');
    console.log('=' .repeat(60));

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('=' .repeat(60) + '\n');

    // ============================================
    // STEP 1: Fetch existing categories
    // ============================================
    console.log('📂 STEP 1: Fetching existing categories...');
    const categories = await Category.find().limit(10);

    if (categories.length === 0) {
      console.error('❌ No categories found! Please create categories first.');
      process.exit(1);
    }

    console.log(`✅ Found ${categories.length} categories:`);
    categories.forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat.name} (${cat.slug})`);
    });
    console.log();

    // ============================================
    // STEP 2: Create/fetch test users
    // ============================================
    console.log('👤 STEP 2: Creating test users...');
    
    const testUsers = [];
    for (let i = 0; i < 20; i++) {
      const email = `testuser${i + 1}@oeplast.com`;
      let user = await User.findOne({ email });

      if (!user) {
        user = await User.create({
          firstName: firstNames[i % firstNames.length],
          lastName: lastNames[i % lastNames.length],
          email,
          password: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', // Hashed placeholder
          phoneNumber: `+234${8000000000 + i}`,
          role: 'user',
        });
      }
      testUsers.push(user);
    }

    console.log(`✅ Created/found ${testUsers.length} test users\n`);

    // ============================================
    // STEP 3: Create 12 coupons
    // ============================================
    console.log('🎟️  STEP 3: Creating 12 coupons...');
    
    // Delete existing test coupons
    await Coupon.deleteMany({ coupon: { $in: couponTemplates.map((c) => c.coupon) } });

    const coupons = await Coupon.insertMany(
      couponTemplates.map((template) => ({
        ...template,
        creator: new mongoose.Types.ObjectId(ADMIN_USER_ID),
        minOrderValue: template.discountType === 'percentage' ? randomInt(5000, 10000) : randomInt(2000, 5000),
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Started 30 days ago
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Ends in 90 days
        active: true,
        maxUsage: randomInt(50, 200),
        timesUsed: 0,
      }))
    );

    console.log(`✅ Created ${coupons.length} coupons:`);
    coupons.forEach((coupon) => {
      const discountDisplay = coupon.discountType === 'percentage' ? `${coupon.discount}%` : `₦${coupon.discount}`;
      console.log(`   - ${coupon.coupon}: ${discountDisplay} off (min: ₦${coupon.minOrderValue})`);
    });
    console.log();

    // ============================================
    // STEP 4: Create 40 products
    // ============================================
    console.log('📦 STEP 4: Creating 40 products...');

    const productsToCreate = [];
    const productsPerCategory = Math.ceil(40 / categories.length);

    for (const category of categories) {
      const categoryName = category.name;
      const productNames = productNamesByCategory[categoryName] || [
        `${categoryName} Item 1`,
        `${categoryName} Item 2`,
        `${categoryName} Item 3`,
        `${categoryName} Item 4`,
        `${categoryName} Item 5`,
      ];

      const productsForThisCategory = Math.min(productsPerCategory, productNames.length);

      for (let i = 0; i < productsForThisCategory; i++) {
        if (productsToCreate.length >= 40) break;

        const basePrice = randomPrice();
        const hasDiscount = Math.random() > 0.6; // 40% have discounts
        const discountPercent = hasDiscount ? randomInt(10, 30) : 0;

        const sku: number = 10000 + productsToCreate.length + 1;

        productsToCreate.push({
          sku,
          name: productNames[i],
          slug: `${productNames[i].toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sku}`,
          description: `High-quality ${productNames[i].toLowerCase()} made from durable plastic material. Perfect for wholesale and retail distribution. Available in various colors and sizes.`,
          price: basePrice,
          category: category._id,
          stock: randomInt(50, 500),
          sold: randomInt(0, 200),
          rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 to 5.0
          discount: discountPercent,
          tags: ['wholesale', 'plastic', 'durable', categoryName.toLowerCase()],
          description_images: [
            {
              url: randomPick(productImages, 1)[0], // Randomly pick one image
              cover_image: true,
            },
          ],
          status: Math.random() > 0.1 ? 'active' : 'inactive', // 90% active
          specifications: [
            { key: 'Material', value: 'High-grade plastic' },
            { key: 'Color', value: ['Blue', 'Red', 'Green', 'White'][randomInt(0, 3)] },
            { key: 'Warranty', value: '6 months' },
          ],
          dimension: [
            { key: 'length', value: `${randomInt(10, 50)}cm` },
            { key: 'width', value: `${randomInt(10, 50)}cm` },
            { key: 'height', value: `${randomInt(5, 30)}cm` },
          ],
          shipping: {
            addedCost: randomInt(0, 1000),
            increaseCostBy: randomInt(0, 500),
            addedDays: randomInt(0, 3),
          },
          lowStockThreshold: 20,
          pricingTiers: [
            { minQty: 10, maxQty: 49, strategy: 'percentOff', value: 5 }, // 5% off
            { minQty: 50, maxQty: 99, strategy: 'percentOff', value: 10 }, // 10% off
            { minQty: 100, maxQty: undefined, strategy: 'percentOff', value: 15 }, // 15% off
          ],
        });
      }
    }

    // Delete existing test products (with sku >= 10000)
    await Product.deleteMany({ sku: { $gte: 10000 } });

    const products = await Product.insertMany(productsToCreate);
    console.log(`✅ Created ${products.length} products across ${categories.length} categories\n`);

    // ============================================
    // STEP 5: Create 100 orders with transactions
    // ============================================
    console.log('🛒 STEP 5: Creating 100 orders with transactions...');

    const ordersToCreate = [];
    const transactionsToCreate = [];

    for (let i = 0; i < 100; i++) {
      const user = randomPick(testUsers, 1)[0];
      const orderDate = randomDate(120); // Orders from last 120 days
      
      // Pick 1-5 random products for the order
      const orderProducts = randomPick(products, randomInt(1, 5));
      
      // Calculate order totals
      let totalBeforeDiscount = 0;
      const productsInOrder = orderProducts.map((product) => {
        const qty = randomInt(1, 10);
        const price = product.price;
        totalBeforeDiscount += price * qty;

        return {
          product: product._id,
          qty,
          price,
          attributes: [],
          saleDiscount: product.discount || 0,
        };
      });

      // Apply coupon randomly (30% of orders have coupons)
      const hasCoupon = Math.random() < 0.3;
      let couponDiscount = 0;
      let appliedCoupon = null;

      if (hasCoupon && totalBeforeDiscount >= 5000) {
        appliedCoupon = randomPick(coupons, 1)[0];
        if (appliedCoupon.discountType === 'percentage') {
          couponDiscount = (totalBeforeDiscount * appliedCoupon.discount) / 100;
        } else {
          couponDiscount = appliedCoupon.discount;
        }
      }

      // Calculate shipping
      const shippingPrice = randomInt(1000, 5000);
      const total = totalBeforeDiscount - couponDiscount + shippingPrice;

      // Pick order and transaction status
      const orderStatus = pickWeightedStatus(orderStatusWeights);
      const transactionStatus = orderStatus === 'Completed' 
        ? 'completed' 
        : orderStatus === 'Cancelled' 
        ? 'failed' 
        : pickWeightedStatus(transactionStatusWeights);

      const isPaid = transactionStatus === 'completed';

      // Create shipping address
      const location = randomPick(nigerianLocations, 1)[0];
      const shippingAddress = {
        firstName: user.firstName,
        lastName: user.lastName || 'Customer',
        phoneNumber: (user as any).phoneNumber || '+2348000000000',
        address: `${randomInt(1, 100)} ${['Allen Avenue', 'Admiralty Way', 'Awolowo Road', 'Herbert Macaulay'][randomInt(0, 3)]}`,
        city: location.city,
        state: location.state,
        country: 'Nigeria',
        zipCode: `${randomInt(10000, 99999)}`,
      };

      // Create transaction first
      const paymentMethodValue = randomPick(paymentMethods, 1)[0];
      const paymentGatewayValue = paymentMethodValue === 'bank_transfer' ? 'manual' : paymentMethodValue;
      
      const transaction: any = {
        userId: user._id,
        amount: total,
        currency: 'NGN',
        transactionType: 'order_payment',
        status: transactionStatus,
        paymentMethod: paymentMethodValue,
        paymentGateway: paymentGatewayValue,
        reference: `TXN-${Date.now()}-${randomInt(1000, 9999)}-${i}`,
        paymentDate: orderDate,
        paidAt: transactionStatus === 'completed' ? new Date(orderDate.getTime() + randomInt(1000, 60000)) : undefined,
        customerInfo: {
          email: user.email,
          name: `${user.firstName} ${user.lastName || 'Customer'}`,
          phone: (user as any).phoneNumber || '+2348000000000',
        },
        fees: {
          gatewayFee: transactionStatus === 'completed' ? Math.round(total * 0.015) : 0, // 1.5% gateway fee
          processingFee: 100,
          totalFees: transactionStatus === 'completed' ? Math.round(total * 0.015) + 100 : 0,
        },
        metadata: {
          orderNumber: `#${10000 + i}`,
          productsCount: productsInOrder.length,
        },
        createdAt: orderDate,
        updatedAt: new Date(orderDate.getTime() + randomInt(1000, 60000)),
      };

      transactionsToCreate.push(transaction);

      // Create order
      const order: any = {
        user: user._id,
        products: productsInOrder,
        shippingAddress,
        paymentMethod: transaction.paymentMethod,
        total,
        totalBeforeDiscount,
        couponDiscount,
        coupon: appliedCoupon?._id,
        deliveryType: 'shipping',
        shippingPrice,
        taxPrice: 0,
        isPaid,
        status: orderStatus,
        flashSaleApplied: [],
        createdAt: orderDate,
        updatedAt: new Date(orderDate.getTime() + randomInt(60000, 3600000)),
      };

      // Add delivery date if completed
      if (orderStatus === 'Completed') {
        order.deliveredAt = new Date(orderDate.getTime() + randomInt(86400000, 604800000)); // 1-7 days later
        order.isPaid = true;
      }

      ordersToCreate.push(order);
    }

    // Insert orders first (without transactionId)
    const orders = await Order.insertMany(ordersToCreate);
    console.log(`✅ Created ${orders.length} orders`);

    // Update transactions with orderId
    transactionsToCreate.forEach((transaction, idx) => {
      transaction.orderId = orders[idx]._id;
    });

    // Insert transactions
    const insertedTransactions = await Transaction.insertMany(transactionsToCreate);
    console.log(`✅ Created ${insertedTransactions.length} transactions`);

    // Update orders with transactionId
    await Promise.all(
      orders.map((order, idx) => 
        Order.findByIdAndUpdate(order._id, { transactionId: insertedTransactions[idx]._id })
      )
    );
    console.log(`✅ Linked orders to transactions\n`);

    // ============================================
    // STATISTICS
    // ============================================
    console.log('=' .repeat(60));
    console.log('📊 SEEDING STATISTICS');
    console.log('=' .repeat(60));

    // Count order statuses
    const orderStats = await Order.aggregate([
      { $match: { _id: { $in: orders.map((o) => o._id) } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log('\n📦 Orders by Status:');
    orderStats.forEach((stat) => {
      console.log(`   ${stat._id}: ${stat.count} orders`);
    });

    // Count transaction statuses
    const transactionStats = await Transaction.aggregate([
      { $match: { _id: { $in: insertedTransactions.map((t) => t._id) } } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { count: -1 } },
    ]);

    console.log('\n💳 Transactions by Status:');
    transactionStats.forEach((stat) => {
      console.log(`   ${stat._id}: ${stat.count} transactions (₦${stat.totalAmount.toLocaleString()})`);
    });

    // Coupon usage
    const ordersWithCoupons = orders.filter((o) => o.coupon).length;
    console.log(`\n🎟️  Coupons Applied: ${ordersWithCoupons} orders (${((ordersWithCoupons / orders.length) * 100).toFixed(1)}%)`);

    // Total revenue
    const totalRevenue = orders
      .filter((o) => o.isPaid)
      .reduce((sum, o) => sum + o.total, 0);
    console.log(`\n💰 Total Revenue: ₦${totalRevenue.toLocaleString()}`);

    console.log('\n=' .repeat(60));
    console.log('✅ TEST DATA SEEDING COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    console.log('\n🎉 Summary:');
    console.log(`   - ${coupons.length} coupons created`);
    console.log(`   - ${products.length} products created`);
    console.log(`   - ${orders.length} orders created`);
    console.log(`   - ${insertedTransactions.length} transactions created`);
    console.log(`   - ${testUsers.length} test users`);
    console.log();

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  }
}

// ============================================
// RUN SCRIPT
// ============================================

seedTestData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
