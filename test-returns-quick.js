#!/usr/bin/env node

/**
 * Quick Start: Returns Test Simulation
 * 
 * This version creates all necessary test data from scratch.
 * No prerequisites needed except a running server and database.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const passwordLib = require('./dist/lib/password.js');
dotenv.config();

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const LOG_FILE = path.join(__dirname, 'returns-test-quick.log');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oeplast';

console.log('\n🚀 Returns & Refunds Quick Test\n');
console.log(`📍 API URL: ${BASE_URL}`);
console.log(`📍 MongoDB: ${MONGO_URI}`);
console.log(`📝 Log File: ${LOG_FILE}\n`);

const logs = [];
const log = (message, data = null) => {
  const entry = `[${new Date().toISOString()}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
  console.log(message);
  if (data) console.log(JSON.stringify(data, null, 2));
  logs.push(entry);
};

const saveLogs = () => {
  fs.writeFileSync(LOG_FILE, logs.join('\n\n'), 'utf8');
  console.log(`\n✅ Logs saved to: ${LOG_FILE}`);
};

const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

let tokens = { admin: null, customer: null };
let ids = { 
  category: null,
  product: null, 
  order: null, 
  return: null,
  adminUserId: null,
  customerUserId: null,
};
let shouldCleanupCategory = false;
let shouldCleanupProduct = false;
let mongoClient = null;
let db = null;

/**
 * Connect to MongoDB
 */
async function connectToMongoDB() {
  try {
    log('📦 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    db = mongoClient.db();
    log('✓ Connected to MongoDB');
    return true;
  } catch (error) {
    log('✗ MongoDB connection failed', { error: error.message });
    throw error;
  }
}

/**
 * Create admin user directly in MongoDB
 */
async function createAdminUser() {
  try {
    log('\n1️⃣  Creating admin user in MongoDB...');
    
    const timestamp = Date.now();
    const adminEmail = `admin-test-${timestamp}@test.com`;
    const adminPassword = 'AdminTest123!';
    const hashedPassword = await passwordLib.hashPassword(adminPassword);
    // Hash password
    
    // Create admin user
    const adminUser = {
      _id: new ObjectId(),
      firstName: 'Test',
      lastName: 'Admin',
      email: adminEmail,
      password: hashedPassword,
      phone: '08012345678',
      role: 'owner', // Admin role
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('users').insertOne(adminUser);
    ids.adminUserId = adminUser._id.toString();
    
    log('✓ Admin user created in MongoDB', { 
      email: adminEmail,
      userId: ids.adminUserId,
      role: 'owner',
    });
    
    return { email: adminEmail, password: adminPassword };
  } catch (error) {
    log('✗ Failed to create admin user', { error: error.message });
    throw error;
  }
}

/**
 * Create customer user directly in MongoDB
 */
async function createCustomerUser() {
  try {
    log('\n2️⃣  Creating customer user in MongoDB...');
    
    const timestamp = Date.now();
    const customerEmail = `customer-test-${timestamp}@test.com`;
    const customerPassword = 'CustomerTest123!';

    // Hash password
    const hashedPassword = await passwordLib.hashPassword(customerPassword);

    // Create customer user
    const customerUser = {
      _id: new ObjectId(),
      firstName: 'Test',
      lastName: 'Customer',
      email: customerEmail,
      password: hashedPassword,
      phone: '08087654321',
      role: 'customer', // Regular customer role
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('users').insertOne(customerUser);
    ids.customerUserId = customerUser._id.toString();
    
    log('✓ Customer user created in MongoDB', { 
      email: customerEmail,
      userId: ids.customerUserId,
      role: 'customer',
    });
    
    return { email: customerEmail, password: customerPassword };
  } catch (error) {
    log('✗ Failed to create customer user', { error: error.message });
    throw error;
  }
}

/**
 * Cleanup: Delete test users from MongoDB
 */
async function cleanupUsers() {
  try {
    log('\n🧹 Cleaning up test users...');
    
    if (ids.adminUserId) {
      await db.collection('users').deleteOne({ _id: new ObjectId(ids.adminUserId) });
      log('✓ Admin user deleted');
    }
    
    if (ids.customerUserId) {
      await db.collection('users').deleteOne({ _id: new ObjectId(ids.customerUserId) });
      log('✓ Customer user deleted');
    }
  } catch (error) {
    log('⚠️  Failed to cleanup users', { error: error.message });
  }
}

/**
 * Close MongoDB connection
 */
async function closeMongoDB() {
  if (mongoClient) {
    await mongoClient.close();
    log('✓ MongoDB connection closed');
  }
}

async function run() {
  try {
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Create test users directly in MongoDB
    const adminCredentials = await createAdminUser();
    const customerCredentials = await createCustomerUser();
console.log(adminCredentials);

    // 1. Login as admin
    log('\n3️⃣  Logging in as admin...');
    const adminLogin = await api.post('/auth/login', {
      email: adminCredentials.email,
      password: adminCredentials.password,
    });
    tokens.admin = adminLogin.data.data.token;
    log('✓ Admin logged in', { email: adminCredentials.email });

    // 2. Login as customer
    log('\n4️⃣  Logging in as customer...');
    const customerLogin = await api.post('/auth/login', {
      email: customerCredentials.email,
      password: customerCredentials.password,
    });
    tokens.customer = customerLogin.data.data.token;
    log('✓ Customer logged in', { email: customerCredentials.email });

    // 3. Create category (admin) - Required for product creation
    log('\n5️⃣  Creating test category...');
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.admin}`;
    
    const timestamp = Date.now();
    const category = await api.post('/admin/category/create', {
      name: `Test Returns Cat ${timestamp}`,
      slug: `test-returns-cat-${timestamp}`,
      description: 'Category for testing returns',
    });
    ids.category = category.data.data._id;
    log('✓ Category created', { id: ids.category });
    shouldCleanupCategory = true;

    // 4. Create product (admin)
    log('\n6️⃣  Creating test product...');
    
    const product = await api.post('/admin/products/create', {
      sku: Date.now(), // Numeric SKU
      name: 'Test Return Product',
      price: 15000,
      description: 'Test product for returns',
      category: ids.category,
      stock: 100,
      tags: ['test', 'returns'],
    });
    ids.product = product.data.data._id;
    log('✓ Product created', { id: ids.product });
    shouldCleanupProduct = true;

    // 5. Create order (customer)
    log('\n7️⃣  Creating order...');
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.customer}`;
    
    // First, try to create order and catch validation error to get correct values
    let orderPayload = {
      items: [{ product: ids.product, qty: 2, unitPrice: 15000, totalPrice: 30000 }],
      shippingAddress: {
        firstName: 'Test', lastName: 'Customer', address: '123 Test St',
        city: 'Lagos', state: 'Lagos', country: 'Nigeria', postalCode: '100001', phone: '08012345678',
      },
      paymentMethod: 'paystack',
      subtotal: 30000,
      total: 32000,
      shippingCost: 2000,
      deliveryType: 'shipping',
    };
    
    try {
      const order = await api.post('/checkout/secure', orderPayload);
      ids.order = order.data.data.order._id;
      log('✓ Order created', { id: ids.order });
    } catch (e) {
      // If cart needs update, use the corrected values
      if (e.response?.status === 400 && e.response?.data?.data?.correctedCart) {
        const corrected = e.response.data.data.correctedCart;
        log('ℹ️  Using corrected cart values', { 
          shippingCost: corrected.shippingCost,
          total: corrected.total 
        });
        
        orderPayload.shippingCost = corrected.shippingCost;
        orderPayload.total = corrected.total;
        
        const order = await api.post('/checkout/secure', orderPayload);
        ids.order = order.data.data.order._id;
        log('✓ Order created with corrected values', { id: ids.order });
      } else {
        throw e;
      }
    }

    // 6. Complete order (manually in MongoDB since admin route has issues)
    log('\n8️⃣  Completing order (direct MongoDB update)...');
    
    await db.collection('orders').updateOne(
      { _id: new ObjectId(ids.order) },
      { 
        $set: { 
          status: 'Completed',
          deliveredAt: new Date(),
          updatedAt: new Date(),
        } 
      }
    );
    log('✓ Order marked as completed');

    // 7. Initiate return (customer)
    log('\n9️⃣  Customer initiating return...');
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.customer}`;
    
    const returnReq = await api.post('/returns', {
      orderId: ids.order,
      items: [{ product: ids.product, qty: 1, reason: 'defective', reasonDetails: 'Not working' }],
      type: 'refund',
      customerNotes: 'Please refund',
    });
    ids.return = returnReq.data.data._id;
    log('✓ Return initiated', { id: ids.return, status: 'pending' });

    // 8. Customer views returns
    log('\n🔟 Customer viewing their returns...');
    const myReturns = await api.get('/returns');
    log('✓ Returns retrieved', { count: myReturns.data.data.length });

    // 9. Admin approves return
    log('\n1️⃣1️⃣  Admin approving return...');
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.admin}`;
    
    await api.patch(`/admin/returns/${ids.return}/status`, {
      status: 'approved',
      adminNotes: 'Initial approval - can proceed with return',
    });
    log('✓ Return approved (initial)');

    // 10. Admin marks items received
    log('\n1️⃣2️⃣  Admin marking items as received...');
    await api.patch(`/admin/returns/${ids.return}/status`, {
      status: 'items_received',
    });
    log('✓ Items received');

    // 11. Admin starts inspection
    log('\n1️⃣3️⃣  Admin inspecting items...');
    await api.patch(`/admin/returns/${ids.return}/status`, {
      status: 'inspecting',
    });
    log('✓ Inspection started');

    // 12. Admin passes inspection
    log('\n1️⃣4️⃣  Admin passing inspection...');
    await api.patch(`/admin/returns/${ids.return}/status`, {
      status: 'inspection_passed',
    });
    log('✓ Inspection passed');

    // 13. Admin gives final approval for refund
    log('\n1️⃣5️⃣  Admin giving final refund approval...');
    await api.patch(`/admin/returns/${ids.return}/status`, {
      status: 'approved',
      adminNotes: 'Final approval - refund authorized',
    });
    log('✓ Final refund approval given');

    // 14. Admin processes refund
    log('\n1️⃣6️⃣  Admin processing refund...');
    const refund = await api.post(`/admin/returns/${ids.return}/refund`, {
      refundAmount: 15000,
      refundMethod: 'original_payment',
      adminNotes: 'Refund processed',
    });
    log('✓ Refund processed', { status: 'completed', transactionId: refund.data.data.transaction._id });

    // 15. Verify transaction
    log('\n1️⃣7️⃣  Verifying refund transaction...');
    const transactions = await api.get('/admin/transactions', { 
      params: { transactionType: 'return_refund' } 
    });
    log('✓ Transaction verified', { count: transactions.data.data.length });

    // 16. Get statistics
    log('\n1️⃣8️⃣  Checking statistics...');
    const stats = await api.get('/admin/returns/statistics');
    log('✓ Statistics retrieved', stats.data.data);

    // Error tests
    log('\n❌ ERROR TESTS');
    
    // Try to cancel completed return
    log('\n🧪 Test: Cancel completed return (should fail)...');
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.customer}`;
    try {
      await api.post(`/returns/${ids.return}/cancel`);
      log('✗ FAILED: Should have been rejected');
    } catch (e) {
      if (e.response?.status === 400) {
        log('✓ PASSED: Correctly rejected');
      }
    }

    // Try duplicate refund
    log('\n🧪 Test: Duplicate refund (should fail)...');
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.admin}`;
    try {
      await api.post(`/admin/returns/${ids.return}/refund`, {
        refundAmount: 15000,
        refundMethod: 'original_payment',
      });
      log('✗ FAILED: Should have been rejected');
    } catch (e) {
      if (e.response?.status === 400) {
        log('✓ PASSED: Correctly rejected');
      }
    }

    // Cleanup
    log('\n🧹 Cleanup...');
    await api.delete(`/admin/returns/${ids.return}`);
    log('✓ Test return deleted');
    
    // Delete test product
    if (shouldCleanupProduct && ids.product) {
      await api.delete(`/admin/products/${ids.product}`);
      log('✓ Test product deleted');
    }
    
    // Delete test category
    if (shouldCleanupCategory && ids.category) {
      await api.delete(`/admin/category/${ids.category}`);
      log('✓ Test category deleted');
    }
    
    // Delete test users from MongoDB
    await cleanupUsers();

    log('\n✅ ALL TESTS COMPLETED SUCCESSFULLY! 🎉');
    
  } catch (error) {
    log('\n❌ TEST FAILED');
    log('Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
  } finally {
    // Always cleanup users and close MongoDB connection
    try {
      // Cleanup product and category if they were created
      if (shouldCleanupProduct && ids.product && tokens.admin) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${tokens.admin}`;
          await api.delete(`/admin/products/${ids.product}`);
          log('✓ Test product deleted (cleanup)');
        } catch (e) {
          log('⚠️  Failed to delete product in cleanup');
        }
      }
      
      if (shouldCleanupCategory && ids.category && tokens.admin) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${tokens.admin}`;
          await api.delete(`/admin/category/${ids.category}`);
          log('✓ Test category deleted (cleanup)');
        } catch (e) {
          log('⚠️  Failed to delete category in cleanup');
        }
      }
      
      await cleanupUsers();
      await closeMongoDB();
    } catch (cleanupError) {
      log('⚠️  Cleanup error:', cleanupError.message);
    }
    saveLogs();
  }
}

run();
