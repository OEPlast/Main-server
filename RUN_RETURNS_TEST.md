# Returns & Refunds Test - Quick Start Guide

## Overview

The `test-returns-quick.js` script is a **fully self-contained** end-to-end test that:

1. ✅ Creates test users directly in MongoDB (admin + customer)
2. ✅ Tests complete return/refund workflow (13 steps)
3. ✅ Runs error scenario tests
4. ✅ Cleans up all test data (returns + users)
5. ✅ Generates detailed logs

**No manual setup required** - the test manages everything!

---

## Prerequisites

### 1. Running Backend Server

```bash
# In old-main-server directory
npm run dev
```

**Default URL**: `http://localhost:5000`

### 2. Environment Variables

Ensure `.env` has MongoDB connection:

```env
MONGODB_URI=mongodb://localhost:27017/oeplast
# or your MongoDB Atlas URI
```

### 3. Dependencies

Already installed (from package.json):
- ✅ `bcrypt` - Password hashing
- ✅ `mongodb` - Native MongoDB driver
- ✅ `axios` - HTTP client

---

## Running the Test

### Quick Test (Recommended)

```bash
npm run test:returns:quick
```

**What it does:**
1. Connects to MongoDB
2. Creates admin user (role: 'owner') with bcrypt-hashed password
3. Creates customer user with bcrypt-hashed password
4. Runs complete return workflow:
   - Admin creates product
   - Customer creates order
   - Admin completes order (mock payment)
   - Customer initiates return
   - Customer views their returns
   - Admin approves return
   - Admin marks items received
   - Admin passes inspection
   - Admin processes refund
   - Verifies refund transaction
   - Gets return statistics
5. Runs error tests:
   - Cancel completed return (should fail)
   - Duplicate refund (should fail)
6. Cleanup:
   - Deletes test return
   - Deletes admin user from MongoDB
   - Deletes customer user from MongoDB
   - Closes MongoDB connection

**Output**: Creates `test-returns-quick.log` with detailed logs

**Duration**: ~5-10 seconds

---

## Test Log Example

```
📦 Connecting to MongoDB...
✓ Connected to MongoDB

1️⃣  Creating admin user in MongoDB...
✓ Admin user created in MongoDB
   email: admin-test-1734567890123@test.com
   userId: 507f1f77bcf86cd799439011
   role: owner

2️⃣  Creating customer user in MongoDB...
✓ Customer user created in MongoDB
   email: customer-test-1734567890123@test.com
   userId: 507f191e810c19729de860ea
   role: customer

3️⃣  Logging in as admin...
✓ Admin logged in

4️⃣  Logging in as customer...
✓ Customer logged in

3️⃣  Creating product...
✓ Product created

... [workflow continues] ...

🧹 Cleanup...
✓ Test return deleted
✓ Admin user deleted
✓ Customer user deleted
✓ MongoDB connection closed

✅ ALL TESTS COMPLETED SUCCESSFULLY! 🎉
```

---

## What Gets Created (Temporarily)

### MongoDB Collections Modified:

1. **users** - 2 test users created:
   - `admin-test-{timestamp}@test.com` (role: 'owner')
   - `customer-test-{timestamp}@test.com` (role: 'customer')
   - Both have timestamps in emails to avoid conflicts
   - **Auto-deleted** at end of test

2. **products** - 1 test product
   - **Not deleted** (small data, can accumulate)

3. **orders** - 1 test order
   - **Not deleted** (preserved for audit trail)

4. **returns** - 1 test return
   - **Deleted** at end of test

5. **transactions** - 1 refund transaction
   - **Not deleted** (financial data preservation)

---

## User Management Details

### Admin User Creation

```javascript
{
  _id: ObjectId("..."),
  firstName: "Test",
  lastName: "Admin",
  email: "admin-test-{timestamp}@test.com",
  password: bcrypt.hash("AdminTest123!", 10), // Hashed
  phone: "08012345678",
  role: "owner", // Full admin privileges
  isVerified: true,
  createdAt: Date,
  updatedAt: Date
}
```

### Customer User Creation

```javascript
{
  _id: ObjectId("..."),
  firstName: "Test",
  lastName: "Customer",
  email: "customer-test-{timestamp}@test.com",
  password: bcrypt.hash("CustomerTest123!", 10), // Hashed
  phone: "08087654321",
  role: "customer", // Regular user
  isVerified: true,
  createdAt: Date,
  updatedAt: Date
}
```

### Cleanup Process

```javascript
// At end of test (even if errors occur)
db.collection('users').deleteOne({ _id: adminUserId });
db.collection('users').deleteOne({ _id: customerUserId });
mongoClient.close();
```

---

## Troubleshooting

### Test Fails to Connect to MongoDB

**Error**: `MongoServerError: connect ECONNREFUSED`

**Solution**: 
```bash
# Check if MongoDB is running
mongosh

# Start MongoDB (macOS)
brew services start mongodb-community

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Test Fails with "Admin account not found"

**This shouldn't happen anymore!** The test creates its own admin user.

If you see this error, the MongoDB user creation failed. Check:
1. MongoDB connection is working
2. `bcrypt` package is installed
3. Users collection exists and is accessible

### Users Not Cleaned Up

If test crashes before cleanup:

```javascript
// Manual cleanup (in MongoDB shell)
db.users.deleteMany({ 
  email: { 
    $regex: /^(admin-test-|customer-test-).*@test\.com$/ 
  } 
});
```

### Port Already in Use

Backend server must run on port 5000:

```bash
# Check what's using port 5000
lsof -ti:5000

# Kill the process
kill -9 $(lsof -ti:5000)

# Start backend again
npm run dev
```

---

## Test Coverage

### ✅ Customer Endpoints Tested

1. `POST /returns` - Initiate return
2. `GET /returns` - Get my returns
3. `GET /returns/:id` - Get return details
4. `POST /returns/:id/cancel` - Cancel pending return

### ✅ Admin Endpoints Tested

1. `GET /admin/returns` - Get all returns
2. `GET /admin/returns/statistics` - Get statistics
3. `GET /admin/returns/:id` - Get specific return
4. `PATCH /admin/returns/:id/status` - Update return status (3 times)
5. `POST /admin/returns/:id/refund` - Process refund
6. `DELETE /admin/returns/:id` - Delete return

### ✅ Transaction Endpoints Tested

1. `GET /admin/transactions?transactionType=return_refund` - Get refund transactions

### ✅ Error Scenarios Tested

1. Cancel completed return (should fail)
2. Duplicate refund processing (should fail)

---

## Next Steps

After test passes:

1. ✅ Backend API fully functional
2. 🔜 Build frontend forms:
   - `ReturnStatusUpdateForm.tsx`
   - `RefundProcessForm.tsx`
3. 🔜 Build admin pages:
   - `/admin/returns` (list view)
   - `/admin/returns/[id]` (details view)
4. 🔜 Build customer pages:
   - `/account/returns` (customer's returns)
   - `/account/returns/[id]` (return details)

---

## Alternative: Comprehensive Test

For more detailed testing with error scenarios:

```bash
npm run test:returns
```

This runs `test-returns-simulation.js` with 21 test cases including:
- Invalid return initiations
- Unauthorized access attempts  
- Invalid status transitions
- Edge cases

**Duration**: ~15-20 seconds

---

## Success Criteria

✅ Test passes if you see:

```
✅ ALL TESTS COMPLETED SUCCESSFULLY! 🎉
```

✅ Log file created: `test-returns-quick.log`

✅ MongoDB users cleaned up automatically

✅ No hanging connections or processes

---

## MongoDB User Verification

To verify users were created and deleted:

```javascript
// Before test
db.users.find({ email: /test\.com$/ }).count() // Should be 0

// During test (if you pause it)
db.users.find({ email: /test\.com$/ }).count() // Should be 2

// After test
db.users.find({ email: /test\.com$/ }).count() // Should be 0
```

---

**Note**: This test is designed for development/testing only. Do not run in production!
