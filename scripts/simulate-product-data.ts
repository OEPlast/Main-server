/**
 * Script to simulate product data for testing analytics endpoints
 * 
 * This script creates:
 * 1. 50+ new products (recently created)
 * 2. 50+ products with orders from the last week (top week)
 * 3. 50+ products with completed orders (top sold)
 * 
 * Usage: ts-node scripts/simulate-product-data.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../src/models/Product';
import Order from '../src/models/Order';
import User from '../src/models/User';
import Category from '../src/models/Category';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oeplast';

// Configuration
const NEW_PRODUCTS_COUNT = 50;
const WEEK_PRODUCTS_COUNT = 50;
const TOP_SOLD_PRODUCTS_COUNT = 50;

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function getOrCreateTestUser() {
  try {
    // Find or create a test user for orders
    let testUser = await User.findOne({ email: 'test@example.com' });
    
    if (!testUser) {
      testUser = await User.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'hashedpassword123', // This should be properly hashed in production
        role: 'user',
        verified: true,
      });
      console.log('✅ Created test user');
    } else {
      console.log('✅ Found existing test user');
    }
    
    return testUser;
  } catch (error) {
    console.error('❌ Error getting/creating test user:', error);
    throw error;
  }
}

async function getRandomCategory() {
  try {
    const categories = await Category.aggregate([{ $sample: { size: 1 } }]);
    return categories[0] || null;
  } catch (error) {
    console.error('❌ Error fetching random category:', error);
    return null;
  }
}

/**
 * Generate realistic product data
 */
function generateProductData(index: number, category: any, prefix: string = '') {
  const productTypes = [
    'Premium', 'Deluxe', 'Standard', 'Professional', 'Classic',
    'Modern', 'Vintage', 'Elite', 'Essential', 'Ultimate'
  ];
  
  const productCategories = [
    'Widget', 'Gadget', 'Tool', 'Device', 'Accessory',
    'Component', 'Kit', 'Set', 'Bundle', 'System'
  ];
  
  const type = productTypes[Math.floor(Math.random() * productTypes.length)];
  const cat = productCategories[Math.floor(Math.random() * productCategories.length)];
  
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const name = `${type} ${cat} ${prefix}${index}`;
  const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}-${randomSuffix}`;
  
  return {
    sku: timestamp + index,
    name,
    slug,
    description: `High-quality ${name} with advanced features and durability. Perfect for professional and personal use.`,
    price: Math.floor(Math.random() * 500) + 50, // $50-$550
    stock: Math.floor(Math.random() * 200) + 10, // 10-210 units
    lowStockThreshold: 5,
    status: 'active',
    category: category?._id || null,
    brand: ['TechBrand', 'QualityPro', 'MasterCraft', 'EliteGoods'][Math.floor(Math.random() * 4)],
    tags: ['new', 'featured', 'trending'],
    description_images: [
      {
        url: `https://via.placeholder.com/800x800.png?text=${encodeURIComponent(name)}`,
        cover_image: true,
      }
    ],
    rating: Math.floor(Math.random() * 2) + 3, // 3-5 stars
  };
}

/**
 * Create new products with recent creation dates
 */
async function createNewProducts(count: number) {
  console.log(`\n🔄 Creating ${count} new products...`);
  
  try {
    const products = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const category = await getRandomCategory();
      const productData = generateProductData(i + 1, category, 'new-');
      
      // Set creation date within the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      const product = await Product.create({
        ...productData,
        createdAt,
        updatedAt: createdAt,
      });
      
      products.push(product);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Created ${i + 1}/${count} products`);
      }
    }
    
    console.log(`✅ Created ${products.length} new products`);
    return products;
  } catch (error) {
    console.error('❌ Error creating new products:', error);
    throw error;
  }
}

/**
 * Create orders for products to simulate week sales
 */
async function createWeekOrders(products: any[], userId: mongoose.Types.ObjectId) {
  console.log(`\n🔄 Creating orders for week products (${products.length} products)...`);
  
  try {
    const now = new Date();
    const ordersCreated: number[] = [];
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      // Create 5-20 orders per product within the last 7 days
      const orderCount = Math.floor(Math.random() * 16) + 5;
      
      for (let j = 0; j < orderCount; j++) {
        // Random date within last 7 days
        const daysAgo = Math.floor(Math.random() * 7);
        const hoursAgo = Math.floor(Math.random() * 24);
        const orderDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000);
        
        const qty = Math.floor(Math.random() * 5) + 1; // 1-5 units per order
        const productTotal = product.price * qty;
        const shippingPrice = Math.floor(Math.random() * 20) + 5; // $5-$25 shipping
        const taxPrice = Math.floor(productTotal * 0.08); // 8% tax
        const total = productTotal + shippingPrice + taxPrice;
        
        await Order.create({
          user: userId,
          products: [
            {
              product: product._id,
              qty,
              price: product.price,
              attributes: [],
            }
          ],
          shippingAddress: {
            firstName: 'Test',
            lastName: 'Customer',
            phoneNumber: '1234567890',
            address1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'USA',
          },
          paymentMethod: 'stripe',
          status: 'Completed',
          total,
          totalBeforeDiscount: total,
          deliveryType: 'shipping',
          shippingPrice,
          taxPrice,
          isPaid: true,
          paidAt: orderDate,
          deliveredAt: new Date(orderDate.getTime() + 3 * 24 * 60 * 60 * 1000), // Delivered 3 days later
          createdAt: orderDate,
          updatedAt: orderDate,
        });
      }
      
      ordersCreated.push(orderCount);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Created orders for ${i + 1}/${products.length} products`);
      }
    }
    
    const totalOrders = ordersCreated.reduce((sum, count) => sum + count, 0);
    console.log(`✅ Created ${totalOrders} orders for week products`);
    
    return ordersCreated;
  } catch (error) {
    console.error('❌ Error creating week orders:', error);
    throw error;
  }
}

/**
 * Create orders for products to simulate all-time top sold
 */
async function createTopSoldOrders(products: any[], userId: mongoose.Types.ObjectId) {
  console.log(`\n🔄 Creating orders for top sold products (${products.length} products)...`);
  
  try {
    const now = new Date();
    const ordersCreated: number[] = [];
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      // Create 20-100 orders per product over the last 6 months
      const orderCount = Math.floor(Math.random() * 81) + 20;
      
      for (let j = 0; j < orderCount; j++) {
        // Random date within last 180 days
        const daysAgo = Math.floor(Math.random() * 180);
        const hoursAgo = Math.floor(Math.random() * 24);
        const orderDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000);
        
        const qty = Math.floor(Math.random() * 5) + 1; // 1-5 units per order
        const productTotal = product.price * qty;
        const shippingPrice = Math.floor(Math.random() * 20) + 5; // $5-$25 shipping
        const taxPrice = Math.floor(productTotal * 0.08); // 8% tax
        const total = productTotal + shippingPrice + taxPrice;
        
        await Order.create({
          user: userId,
          products: [
            {
              product: product._id,
              qty,
              price: product.price,
              attributes: [],
            }
          ],
          shippingAddress: {
            firstName: 'Test',
            lastName: 'Customer',
            phoneNumber: '1234567890',
            address1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'USA',
          },
          paymentMethod: 'stripe',
          status: 'Completed',
          total,
          totalBeforeDiscount: total,
          deliveryType: 'shipping',
          shippingPrice,
          taxPrice,
          isPaid: true,
          paidAt: orderDate,
          deliveredAt: new Date(orderDate.getTime() + 3 * 24 * 60 * 60 * 1000), // Delivered 3 days later
          createdAt: orderDate,
          updatedAt: orderDate,
        });
      }
      
      ordersCreated.push(orderCount);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Created orders for ${i + 1}/${products.length} products`);
      }
    }
    
    const totalOrders = ordersCreated.reduce((sum, count) => sum + count, 0);
    console.log(`✅ Created ${totalOrders} orders for top sold products`);
    
    return ordersCreated;
  } catch (error) {
    console.error('❌ Error creating top sold orders:', error);
    throw error;
  }
}

/**
 * Get or create products for week/top-sold simulations
 */
async function getOrCreateProductsForOrders(count: number, type: 'week' | 'topSold') {
  console.log(`\n🔄 Getting/creating ${count} products for ${type}...`);
  
  try {
    // Try to get existing active products
    let products = await Product.find({ status: 'active', stock: { $gt: 10 } })
      .limit(count)
      .lean();
    
    if (products.length >= count) {
      console.log(`✅ Found ${products.length} existing products`);
      return products;
    }
    
    // Need to create more products
    const needed = count - products.length;
    console.log(`⚠️  Only found ${products.length} products, creating ${needed} more...`);
    
    const newProducts = [];
    for (let i = 0; i < needed; i++) {
      const category = await getRandomCategory();
      const prefix = type === 'week' ? 'week-' : 'sold-';
      const productData = generateProductData(products.length + i + 1000, category, prefix);
      
      const product = await Product.create(productData);
      newProducts.push(product.toObject());
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Created ${i + 1}/${needed} additional products`);
      }
    }
    
    return [...products, ...newProducts];
  } catch (error) {
    console.error('❌ Error getting/creating products:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting product data simulation...\n');
  console.log('📊 Configuration:');
  console.log(`   - New Products: ${NEW_PRODUCTS_COUNT}`);
  console.log(`   - Week Products: ${WEEK_PRODUCTS_COUNT}`);
  console.log(`   - Top Sold Products: ${TOP_SOLD_PRODUCTS_COUNT}`);
  console.log('');
  
  await connectDB();
  
  try {
    // Step 1: Get or create test user
    const testUser = await getOrCreateTestUser();
    
    // Step 2: Create new products (with recent creation dates)
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 1: Creating New Products');
    console.log('='.repeat(60));
    const newProducts = await createNewProducts(NEW_PRODUCTS_COUNT);
    
    // Step 3: Create week products with orders
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 2: Creating Week Products & Orders');
    console.log('='.repeat(60));
    const weekProducts = await getOrCreateProductsForOrders(WEEK_PRODUCTS_COUNT, 'week');
    await createWeekOrders(weekProducts, testUser._id);
    
    // Step 4: Create top sold products with many orders
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 3: Creating Top Sold Products & Orders');
    console.log('='.repeat(60));
    const topSoldProducts = await getOrCreateProductsForOrders(TOP_SOLD_PRODUCTS_COUNT, 'topSold');
    await createTopSoldOrders(topSoldProducts, testUser._id);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATA SIMULATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📦 New Products: ${newProducts.length} created`);
    console.log(`📈 Week Products: ${weekProducts.length} products with recent orders`);
    console.log(`🏆 Top Sold Products: ${topSoldProducts.length} products with many orders`);
    console.log('');
    console.log('🔍 Test the endpoints:');
    console.log('   - GET /products/new-products?page=1&limit=20');
    console.log('   - GET /products/top-week?page=1&limit=20');
    console.log('   - GET /products/top-sold?page=1&limit=20');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main();
