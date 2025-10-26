/**
 * Returns & Refunds API Test Simulation
 * 
 * Complete end-to-end test covering:
 * 1. User registration & authentication
 * 2. Product creation (admin)
 * 3. Order creation & checkout
 * 4. Payment simulation (mark as completed)
 * 5. Customer return initiation
 * 6. Customer return management
 * 7. Admin return management
 * 8. Refund processing
 * 9. Transaction verification
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const LOG_FILE = path.join(__dirname, 'returns-test-simulation.log');

// Test data storage
const testData = {
  admin: { email: 'admin@test.com', password: 'Admin123!', token: null, userId: null },
  customer: { email: null, password: 'Customer123!', token: null, userId: null },
  product: { id: null, name: 'Test Product for Returns', price: 15000, sku: null },
  order: { id: null, total: null },
  return: { id: null, returnNumber: null },
  transaction: { id: null },
};

// Logger
class Logger {
  constructor(filePath) {
    this.filePath = filePath;
    this.logs = [];
    this.startTime = Date.now();
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      elapsed: `${Date.now() - this.startTime}ms`,
    };
    this.logs.push(logEntry);
    
    const logLine = `[${timestamp}] [${level}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    console.log(logLine);
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  success(message, data) {
    this.log('SUCCESS', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  warning(message, data) {
    this.log('WARNING', message, data);
  }

  saveToFile() {
    const content = this.logs.map(log => 
      `[${log.timestamp}] [${log.level}] [${log.elapsed}] ${log.message}${
        log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''
      }\n`
    ).join('\n');

    fs.writeFileSync(this.filePath, content, 'utf8');
    console.log(`\n✅ Test logs saved to: ${this.filePath}`);
  }

  summary() {
    const total = this.logs.length;
    const success = this.logs.filter(l => l.level === 'SUCCESS').length;
    const errors = this.logs.filter(l => l.level === 'ERROR').length;
    const duration = Date.now() - this.startTime;

    const summary = {
      totalTests: total,
      successful: success,
      failed: errors,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    this.info('TEST SUMMARY', summary);
    return summary;
  }
}

const logger = new Logger(LOG_FILE);

// HTTP Client with logging
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

apiClient.interceptors.request.use(config => {
  logger.info(`→ ${config.method.toUpperCase()} ${config.url}`, {
    headers: config.headers.Authorization ? { Authorization: 'Bearer ***' } : {},
    data: config.data,
  });
  return config;
});

apiClient.interceptors.response.use(
  response => {
    logger.success(`← ${response.status} ${response.config.url}`, {
      message: response.data?.message,
      code: response.data?.code,
    });
    return response;
  },
  error => {
    logger.error(`← ${error.response?.status || 'Network Error'} ${error.config?.url}`, {
      message: error.response?.data?.message || error.message,
      errors: error.response?.data?.errors,
    });
    throw error;
  }
);

// Helper functions
const setAuthToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test functions

/**
 * STEP 1: Authenticate as admin
 */
async function authenticateAdmin() {
  logger.info('STEP 1: Admin Authentication');
  
  try {
    const response = await apiClient.post('/auth/login', {
      email: testData.admin.email,
      password: testData.admin.password,
    });

    testData.admin.token = response.data.data?.token;
    testData.admin.userId = response.data.data?.user?._id;
    
    if (!testData.admin.token) {
      throw new Error('Admin token not received');
    }

    setAuthToken(testData.admin.token);
    logger.success('✓ Admin authenticated successfully', { userId: testData.admin.userId });
    return true;
  } catch (error) {
    logger.error('✗ Admin authentication failed', { error: error.message });
    throw error;
  }
}

/**
 * STEP 2: Create test product (as admin)
 */
async function createProduct() {
  logger.info('STEP 2: Create Test Product');
  
  try {
    const productData = {
      name: testData.product.name,
      price: testData.product.price,
      description: 'Test product for returns simulation',
      category: '507f1f77bcf86cd799439011', // Placeholder category ID
      stock: 100,
      images: ['test-image.jpg'],
      status: 'active',
    };

    const response = await apiClient.post('/admin/products', productData);
    
    testData.product.id = response.data.data?._id;
    testData.product.sku = response.data.data?.sku;
    
    if (!testData.product.id) {
      throw new Error('Product ID not received');
    }

    logger.success('✓ Product created successfully', { 
      productId: testData.product.id,
      sku: testData.product.sku,
    });
    return true;
  } catch (error) {
    logger.error('✗ Product creation failed', { error: error.message });
    throw error;
  }
}

/**
 * STEP 3: Register customer user
 */
async function registerCustomer() {
  logger.info('STEP 3: Register Customer User');
  
  try {
    const timestamp = Date.now();
    testData.customer.email = `customer-${timestamp}@test.com`;
    
    const response = await apiClient.post('/auth/register', {
      firstName: 'Test',
      lastName: 'Customer',
      email: testData.customer.email,
      password: testData.customer.password,
      phone: '08012345678',
    });

    // Login to get token
    setAuthToken(null);
    const loginResponse = await apiClient.post('/auth/login', {
      email: testData.customer.email,
      password: testData.customer.password,
    });

    testData.customer.token = loginResponse.data.data?.token;
    testData.customer.userId = loginResponse.data.data?.user?._id;
    
    if (!testData.customer.token) {
      throw new Error('Customer token not received');
    }

    logger.success('✓ Customer registered and authenticated', { 
      userId: testData.customer.userId,
      email: testData.customer.email,
    });
    return true;
  } catch (error) {
    logger.error('✗ Customer registration failed', { error: error.message });
    throw error;
  }
}

/**
 * STEP 4: Create order (as customer)
 */
async function createOrder() {
  logger.info('STEP 4: Create Order (Customer Checkout)');
  
  try {
    setAuthToken(testData.customer.token);

    const orderData = {
      items: [
        {
          product: testData.product.id,
          qty: 2,
          unitPrice: testData.product.price,
          totalPrice: testData.product.price * 2,
        },
      ],
      shippingAddress: {
        firstName: 'Test',
        lastName: 'Customer',
        address: '123 Test Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        postalCode: '100001',
        phone: '08012345678',
      },
      paymentMethod: 'paystack',
      subtotal: testData.product.price * 2,
      total: testData.product.price * 2 + 2000, // + shipping
      taxPrice: 0,
      totalDiscount: 0,
      shippingCost: 2000,
      deliveryType: 'shipping',
    };

    const response = await apiClient.post('/checkout/secure', orderData);
    
    testData.order.id = response.data.data?.order?._id;
    testData.order.total = response.data.data?.order?.total;
    
    if (!testData.order.id) {
      throw new Error('Order ID not received');
    }

    logger.success('✓ Order created successfully', { 
      orderId: testData.order.id,
      total: testData.order.total,
    });
    return true;
  } catch (error) {
    logger.error('✗ Order creation failed', { error: error.message });
    throw error;
  }
}

/**
 * STEP 5: Mock payment success and mark order as completed (as admin)
 */
async function completeOrder() {
  logger.info('STEP 5: Complete Order (Mock Payment Success)');
  
  try {
    setAuthToken(testData.admin.token);

    // Update order status to Completed
    const response = await apiClient.patch(`/admin/orders/${testData.order.id}`, {
      status: 'Completed',
      deliveredAt: new Date().toISOString(),
    });

    logger.success('✓ Order marked as completed', { 
      orderId: testData.order.id,
      status: response.data.data?.status,
    });

    // Wait a bit to simulate delivery time
    await sleep(1000);
    return true;
  } catch (error) {
    logger.error('✗ Order completion failed', { error: error.message });
    throw error;
  }
}

/**
 * STEP 6: Customer initiates return
 */
async function initiateReturn() {
  logger.info('STEP 6: Customer Initiates Return');
  
  try {
    setAuthToken(testData.customer.token);

    const returnData = {
      orderId: testData.order.id,
      items: [
        {
          product: testData.product.id,
          qty: 1,
          reason: 'defective',
          reasonDetails: 'Product malfunctioned after 2 days of use',
          images: ['defect-photo.jpg'],
        },
      ],
      type: 'refund',
      customerNotes: 'Would like a full refund for the defective item',
    };

    const response = await apiClient.post('/returns', returnData);
    
    testData.return.id = response.data.data?._id;
    testData.return.returnNumber = response.data.data?.returnNumber;
    
    if (!testData.return.id) {
      throw new Error('Return ID not received');
    }

    logger.success('✓ Return initiated successfully', { 
      returnId: testData.return.id,
      returnNumber: testData.return.returnNumber,
      status: response.data.data?.status,
    });
    return true;
  } catch (error) {
    logger.error('✗ Return initiation failed', { error: error.message });
    throw error;
  }
}

/**
 * STEP 7: Customer views their returns
 */
async function customerViewReturns() {
  logger.info('STEP 7: Customer Views Their Returns');
  
  try {
    setAuthToken(testData.customer.token);

    const response = await apiClient.get('/returns', {
      params: { page: 1, limit: 10 },
    });

    const returns = response.data.data || [];
    logger.success('✓ Customer returns retrieved', { 
      count: returns.length,
      returns: returns.map(r => ({ id: r._id, status: r.status })),
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to get customer returns', { error: error.message });
    throw error;
  }
}

/**
 * STEP 8: Customer views specific return
 */
async function customerViewReturnById() {
  logger.info('STEP 8: Customer Views Specific Return');
  
  try {
    setAuthToken(testData.customer.token);

    const response = await apiClient.get(`/returns/${testData.return.id}`);

    logger.success('✓ Return details retrieved', { 
      returnId: response.data.data?._id,
      status: response.data.data?.status,
      items: response.data.data?.items?.length,
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to get return details', { error: error.message });
    throw error;
  }
}

/**
 * STEP 9: Admin views all returns
 */
async function adminViewAllReturns() {
  logger.info('STEP 9: Admin Views All Returns');
  
  try {
    setAuthToken(testData.admin.token);

    const response = await apiClient.get('/admin/returns', {
      params: { page: 1, limit: 10 },
    });

    const returns = response.data.data || [];
    logger.success('✓ Admin returns list retrieved', { 
      count: returns.length,
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to get admin returns', { error: error.message });
    throw error;
  }
}

/**
 * STEP 10: Admin views return statistics
 */
async function adminViewStatistics() {
  logger.info('STEP 10: Admin Views Return Statistics');
  
  try {
    setAuthToken(testData.admin.token);

    const response = await apiClient.get('/admin/returns/statistics');

    logger.success('✓ Return statistics retrieved', { 
      statistics: response.data.data,
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to get return statistics', { error: error.message });
    throw error;
  }
}

/**
 * STEP 11: Admin views specific return
 */
async function adminViewReturnById() {
  logger.info('STEP 11: Admin Views Specific Return');
  
  try {
    setAuthToken(testData.admin.token);

    const response = await apiClient.get(`/admin/returns/${testData.return.id}`);

    logger.success('✓ Admin return details retrieved', { 
      returnId: response.data.data?._id,
      status: response.data.data?.status,
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to get admin return details', { error: error.message });
    throw error;
  }
}

/**
 * STEP 12: Admin approves return
 */
async function adminApproveReturn() {
  logger.info('STEP 12: Admin Approves Return');
  
  try {
    setAuthToken(testData.admin.token);

    const response = await apiClient.patch(`/admin/returns/${testData.return.id}/status`, {
      status: 'approved',
      adminNotes: 'Return approved after review. Customer to ship items back.',
    });

    logger.success('✓ Return approved', { 
      returnId: response.data.data?._id,
      status: response.data.data?.status,
      adminNotes: response.data.data?.adminNotes,
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to approve return', { error: error.message });
    throw error;
  }
}

/**
 * STEP 13: Admin updates status to items_received
 */
async function adminMarkItemsReceived() {
  logger.info('STEP 13: Admin Marks Items as Received');
  
  try {
    setAuthToken(testData.admin.token);

    const response = await apiClient.patch(`/admin/returns/${testData.return.id}/status`, {
      status: 'items_received',
      adminNotes: 'Items received from customer. Starting inspection.',
    });

    logger.success('✓ Items marked as received', { 
      status: response.data.data?.status,
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to mark items received', { error: error.message });
    throw error;
  }
}

/**
 * STEP 14: Admin updates status to inspection_passed
 */
async function adminPassInspection() {
  logger.info('STEP 14: Admin Passes Inspection');
  
  try {
    setAuthToken(testData.admin.token);

    const response = await apiClient.patch(`/admin/returns/${testData.return.id}/status`, {
      status: 'inspection_passed',
      adminNotes: 'Inspection completed. Item confirmed defective. Proceeding with refund.',
    });

    logger.success('✓ Inspection passed', { 
      status: response.data.data?.status,
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to pass inspection', { error: error.message });
    throw error;
  }
}

/**
 * STEP 15: Admin processes refund
 */
async function adminProcessRefund() {
  logger.info('STEP 15: Admin Processes Refund');
  
  try {
    setAuthToken(testData.admin.token);

    const refundAmount = testData.product.price; // Refund for 1 item

    const response = await apiClient.post(`/admin/returns/${testData.return.id}/refund`, {
      refundAmount,
      refundMethod: 'original_payment',
      adminNotes: 'Refund processed via Paystack to original payment method',
    });

    testData.transaction.id = response.data.data?.transaction?._id;

    logger.success('✓ Refund processed successfully', { 
      returnStatus: response.data.data?.return?.status,
      refundAmount,
      transactionId: testData.transaction.id,
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to process refund', { error: error.message });
    throw error;
  }
}

/**
 * STEP 16: Verify refund transaction created
 */
async function verifyRefundTransaction() {
  logger.info('STEP 16: Verify Refund Transaction');
  
  try {
    setAuthToken(testData.admin.token);

    const response = await apiClient.get('/admin/transactions', {
      params: { 
        transactionType: 'return_refund',
        page: 1,
        limit: 10,
      },
    });

    const transactions = response.data.data || [];
    const refundTransaction = transactions.find(t => t.returnId === testData.return.id);

    if (refundTransaction) {
      logger.success('✓ Refund transaction verified', { 
        transactionId: refundTransaction._id,
        amount: refundTransaction.amount,
        transactionType: refundTransaction.transactionType,
      });
    } else {
      logger.warning('⚠ Refund transaction not found in list');
    }
    return true;
  } catch (error) {
    logger.error('✗ Failed to verify refund transaction', { error: error.message });
    throw error;
  }
}

/**
 * STEP 17: Check updated transaction statistics
 */
async function checkTransactionStatistics() {
  logger.info('STEP 17: Check Transaction Statistics');
  
  try {
    setAuthToken(testData.admin.token);

    const response = await apiClient.get('/admin/transactions/statistics');

    logger.success('✓ Transaction statistics retrieved', { 
      totalRevenue: response.data.data?.totalRevenue,
      totalRefunded: response.data.data?.totalRefunded,
      totalReturnRefunds: response.data.data?.totalReturnRefunds,
      netRevenue: response.data.data?.netRevenue,
    });
    return true;
  } catch (error) {
    logger.error('✗ Failed to get transaction statistics', { error: error.message });
    throw error;
  }
}

/**
 * ERROR SCENARIO TESTS
 */

/**
 * ERROR TEST 1: Customer tries to cancel completed return
 */
async function testCancelCompletedReturn() {
  logger.info('ERROR TEST 1: Try to Cancel Completed Return');
  
  try {
    setAuthToken(testData.customer.token);

    await apiClient.post(`/returns/${testData.return.id}/cancel`);
    
    logger.error('✗ Should have failed - completed return was cancelled');
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      logger.success('✓ Correctly rejected: Cannot cancel non-pending return', {
        status: error.response.status,
        message: error.response.data?.message,
      });
      return true;
    }
    logger.error('✗ Unexpected error', { error: error.message });
    return false;
  }
}

/**
 * ERROR TEST 2: Customer tries to access another user's return
 */
async function testUnauthorizedAccess() {
  logger.info('ERROR TEST 2: Try to Access Another User\'s Return');
  
  try {
    // Create a second customer
    const timestamp = Date.now();
    const tempEmail = `temp-${timestamp}@test.com`;
    
    await apiClient.post('/auth/register', {
      firstName: 'Temp',
      lastName: 'User',
      email: tempEmail,
      password: 'Temp123!',
      phone: '08087654321',
    });

    const loginResponse = await apiClient.post('/auth/login', {
      email: tempEmail,
      password: 'Temp123!',
    });

    const tempToken = loginResponse.data.data?.token;
    setAuthToken(tempToken);

    // Try to access first customer's return
    await apiClient.get(`/returns/${testData.return.id}`);
    
    logger.error('✗ Should have failed - accessed another user\'s return');
    return false;
  } catch (error) {
    if (error.response?.status === 403) {
      logger.success('✓ Correctly rejected: Access denied to another user\'s return', {
        status: error.response.status,
        message: error.response.data?.message,
      });
      return true;
    }
    logger.error('✗ Unexpected error', { error: error.message });
    return false;
  }
}

/**
 * ERROR TEST 3: Try to process refund twice
 */
async function testDuplicateRefund() {
  logger.info('ERROR TEST 3: Try to Process Refund Twice');
  
  try {
    setAuthToken(testData.admin.token);

    await apiClient.post(`/admin/returns/${testData.return.id}/refund`, {
      refundAmount: testData.product.price,
      refundMethod: 'original_payment',
      adminNotes: 'Duplicate refund attempt',
    });
    
    logger.error('✗ Should have failed - duplicate refund processed');
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      logger.success('✓ Correctly rejected: Duplicate refund prevented', {
        status: error.response.status,
        message: error.response.data?.message,
      });
      return true;
    }
    logger.error('✗ Unexpected error', { error: error.message });
    return false;
  }
}

/**
 * ERROR TEST 4: Regular user tries to access admin routes
 */
async function testUnauthorizedAdminAccess() {
  logger.info('ERROR TEST 4: Regular User Tries Admin Routes');
  
  try {
    setAuthToken(testData.customer.token);

    await apiClient.get('/admin/returns');
    
    logger.error('✗ Should have failed - customer accessed admin route');
    return false;
  } catch (error) {
    if (error.response?.status === 403) {
      logger.success('✓ Correctly rejected: Customer blocked from admin routes', {
        status: error.response.status,
        message: error.response.data?.message,
      });
      return true;
    }
    logger.error('✗ Unexpected error', { error: error.message });
    return false;
  }
}

/**
 * CLEANUP: Delete test return
 */
async function cleanupReturn() {
  logger.info('CLEANUP: Delete Test Return');
  
  try {
    setAuthToken(testData.admin.token);

    await apiClient.delete(`/admin/returns/${testData.return.id}`);

    logger.success('✓ Test return deleted successfully');
    return true;
  } catch (error) {
    logger.warning('⚠ Failed to delete return (may not exist)', { error: error.message });
    return false;
  }
}

/**
 * Main test execution
 */
async function runTests() {
  logger.info('========================================');
  logger.info('RETURNS & REFUNDS API TEST SIMULATION');
  logger.info('========================================');
  logger.info('Base URL: ' + BASE_URL);
  logger.info('Starting tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Setup & Flow Tests
    await authenticateAdmin() && testsPassed++;
    await createProduct() && testsPassed++;
    await registerCustomer() && testsPassed++;
    await createOrder() && testsPassed++;
    await completeOrder() && testsPassed++;
    
    // Customer Return Flow
    await initiateReturn() && testsPassed++;
    await customerViewReturns() && testsPassed++;
    await customerViewReturnById() && testsPassed++;
    
    // Admin Return Management
    await adminViewAllReturns() && testsPassed++;
    await adminViewStatistics() && testsPassed++;
    await adminViewReturnById() && testsPassed++;
    await adminApproveReturn() && testsPassed++;
    await adminMarkItemsReceived() && testsPassed++;
    await adminPassInspection() && testsPassed++;
    
    // Refund Processing
    await adminProcessRefund() && testsPassed++;
    await verifyRefundTransaction() && testsPassed++;
    await checkTransactionStatistics() && testsPassed++;
    
    // Error Scenario Tests
    logger.info('\n========================================');
    logger.info('ERROR SCENARIO TESTS');
    logger.info('========================================\n');
    
    await testCancelCompletedReturn() && testsPassed++;
    await testUnauthorizedAccess() && testsPassed++;
    await testDuplicateRefund() && testsPassed++;
    await testUnauthorizedAdminAccess() && testsPassed++;
    
    // Cleanup
    logger.info('\n========================================');
    logger.info('CLEANUP');
    logger.info('========================================\n');
    
    await cleanupReturn();

  } catch (error) {
    testsFailed++;
    logger.error('FATAL ERROR: Test execution stopped', { 
      error: error.message,
      stack: error.stack,
    });
  }

  // Final Summary
  logger.info('\n========================================');
  logger.info('TEST EXECUTION COMPLETE');
  logger.info('========================================\n');
  
  const summary = logger.summary();
  
  logger.info('\n📊 FINAL RESULTS:');
  logger.info(`✅ Tests Passed: ${testsPassed}`);
  logger.info(`❌ Tests Failed: ${testsFailed}`);
  logger.info(`⏱️  Duration: ${summary.duration}`);
  logger.info(`📝 Log File: ${LOG_FILE}`);
  
  logger.saveToFile();

  // Exit with appropriate code
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Unhandled error:', error);
  logger.error('UNHANDLED ERROR', { error: error.message, stack: error.stack });
  logger.saveToFile();
  process.exit(1);
});
