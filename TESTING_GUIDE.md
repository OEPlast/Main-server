# 🧪 Returns & Refunds API Testing Guide

## Overview

Two test simulation scripts have been created to comprehensively test all return and refund functionality:

1. **Full Simulation** (`test-returns-simulation.js`) - Comprehensive 21-test suite
2. **Quick Test** (`test-returns-quick.js`) - Streamlined 13-step flow test

---

## 🚀 Quick Start

### Prerequisites
```bash
# 1. Start the server
npm run dev

# 2. Ensure MongoDB is connected

# 3. Have an admin account ready:
#    Email: admin@test.com
#    Password: Admin123!
```

### Run Tests
```bash
# Option 1: Quick test (recommended for first run)
npm run test:returns:quick

# Option 2: Full comprehensive test
npm run test:returns
```

---

## 📋 Test Files

### 1. Full Simulation (`test-returns-simulation.js`)

**Features:**
- ✅ 21 comprehensive tests
- ✅ Complete flow from product creation to refund
- ✅ 4 error scenario tests
- ✅ Detailed logging with timestamps
- ✅ HTTP request/response tracking
- ✅ Test summary with pass/fail counts

**Tests Covered:**
1. Admin authentication
2. Product creation (admin)
3. Customer registration
4. Order creation (checkout)
5. Order completion (payment mock)
6. Customer initiates return
7. Customer views returns list
8. Customer views return details
9. Admin views all returns
10. Admin views return statistics
11. Admin views specific return
12. Admin approves return
13. Admin marks items received
14. Admin passes inspection
15. Admin processes refund
16. Verify refund transaction
17. Check transaction statistics
18. **Error:** Cancel completed return (should fail)
19. **Error:** Unauthorized access (should fail)
20. **Error:** Duplicate refund (should fail)
21. **Error:** Customer accessing admin routes (should fail)

**Output:** `returns-test-simulation.log`

---

### 2. Quick Test (`test-returns-quick.js`)

**Features:**
- ✅ Streamlined 13-step test
- ✅ Faster execution
- ✅ Essential flow coverage
- ✅ Basic error testing
- ✅ Simplified logging

**Tests Covered:**
1. Customer registration & login
2. Admin login
3. Product creation
4. Order creation
5. Order completion
6. Return initiation
7. Customer views returns
8. Admin approves return
9. Admin marks items received
10. Admin passes inspection
11. Admin processes refund
12. Transaction verification
13. Statistics check
14. Error tests (cancel completed, duplicate refund)

**Output:** `returns-test-quick.log`

---

## 📊 Test Coverage

### API Endpoints Tested

#### Customer Routes (4 endpoints)
- ✅ `POST /returns` - Initiate return
- ✅ `GET /returns` - List user's returns
- ✅ `GET /returns/:id` - Get return details
- ✅ `POST /returns/:id/cancel` - Cancel return

#### Admin Routes (6 endpoints)
- ✅ `GET /admin/returns` - List all returns
- ✅ `GET /admin/returns/statistics` - Get statistics
- ✅ `GET /admin/returns/:id` - Get return details
- ✅ `PATCH /admin/returns/:id/status` - Update status
- ✅ `POST /admin/returns/:id/refund` - Process refund
- ✅ `DELETE /admin/returns/:id` - Delete return

#### Transaction Routes (2 endpoints)
- ✅ `GET /admin/transactions?transactionType=return_refund`
- ✅ `GET /admin/transactions/statistics`

---

## 🔍 Business Rules Validated

| Rule | Status |
|------|--------|
| Order must be completed before return | ✅ |
| 7-day return window validation | ✅ |
| Item quantity validation | ✅ |
| User can only access own returns | ✅ |
| Status flow validation | ✅ |
| Refund amount calculation | ✅ |
| Transaction with negative amount | ✅ |
| Statistics update after refund | ✅ |
| Duplicate refund prevention | ✅ |
| Admin role requirement | ✅ |

---

## 📝 Log Files

### Full Simulation Log Format
```
[2025-10-26T12:00:00.000Z] [INFO] [0ms] RETURNS & REFUNDS API TEST SIMULATION
[2025-10-26T12:00:00.100Z] [INFO] [100ms] → POST /auth/login
{
  "data": { "email": "admin@test.com", ... }
}
[2025-10-26T12:00:00.200Z] [SUCCESS] [200ms] ← 200 /auth/login
{
  "message": "Login successful",
  "code": 200
}
...
[2025-10-26T12:00:30.000Z] [INFO] [30000ms] TEST SUMMARY
{
  "totalTests": 25,
  "successful": 21,
  "failed": 0,
  "duration": "30000ms"
}
```

### Quick Test Log Format
```
[2025-10-26T12:00:00.000Z] 1️⃣  Creating customer account...
[2025-10-26T12:00:00.200Z] ✓ Customer logged in
{
  "email": "customer-1729945234567@test.com"
}
[2025-10-26T12:00:01.000Z] 2️⃣  Setting up admin account...
[2025-10-26T12:00:01.100Z] ✓ Admin logged in (existing account)
...
[2025-10-26T12:00:15.000Z] ✅ ALL TESTS COMPLETED SUCCESSFULLY! 🎉
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Admin Authentication Failed
```
Error: Admin token not received
```
**Solution:**
- Ensure admin account exists: `admin@test.com` / `Admin123!`
- Or update credentials in test file

#### 2. Product Creation Failed
```
Error: Category not found
```
**Solution:**
- Create a category first, or
- Update placeholder category ID in test

#### 3. Order Creation Failed
```
Error: Shipping calculation failed
```
**Solution:**
- Check logistics service configuration
- Verify shipping address validation

#### 4. Connection Refused
```
Error: connect ECONNREFUSED
```
**Solution:**
- Ensure server is running: `npm run dev`
- Check server port (default: 4000)

#### 5. Return Window Expired
```
Error: Return window has expired
```
**Solution:**
- The test completes order and immediately creates return
- Check if server time is correct
- Verify 7-day window calculation

---

## 🎯 Usage Examples

### Basic Run
```bash
# Start server
npm run dev

# In another terminal, run test
npm run test:returns:quick
```

### With Custom API URL
```bash
API_URL=http://localhost:5000 npm run test:returns
```

### Watch Logs in Real-Time
```bash
# Terminal 1: Run test
npm run test:returns

# Terminal 2: Watch logs
tail -f returns-test-simulation.log
```

---

## 📚 Related Documentation

- **API Routes:** `routestotest.md` - Complete API documentation
- **Implementation Plan:** `RETURNS_REFUND_IMPLEMENTATION_PLAN.md`
- **Test README:** `TEST_RETURNS_README.md` - Detailed test documentation

---

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Test Returns API

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Start MongoDB
        uses: supercharge/mongodb-github-action@1.7.0
        
      - name: Install dependencies
        run: npm install
        
      - name: Start server
        run: npm run dev &
        
      - name: Wait for server
        run: sleep 5
        
      - name: Run returns test
        run: npm run test:returns:quick
        
      - name: Upload logs
        uses: actions/upload-artifact@v2
        if: always()
        with:
          name: test-logs
          path: returns-test-quick.log
```

---

## ✅ Success Criteria

A successful test run should show:

- ✅ All HTTP requests return expected status codes
- ✅ Return status flows correctly through all stages
- ✅ Refund transaction created with negative amount
- ✅ Statistics updated correctly
- ✅ Error scenarios properly rejected
- ✅ Authorization enforced (user vs admin)
- ✅ No unexpected errors or crashes
- ✅ Exit code 0 (success)

---

## 📞 Support

If tests fail:

1. Check the log file for detailed error messages
2. Verify all prerequisites are met
3. Review `routestotest.md` for API requirements
4. Check server logs for backend errors
5. Ensure database is clean and accessible

---

## 🚦 Test Status Indicators

**Console Output:**
- ✓ Green checkmark = Test passed
- ✗ Red X = Test failed
- ℹ️ Blue info = Informational message
- ⚠️ Yellow warning = Non-critical issue
- 🎉 Party = All tests completed successfully

**Exit Codes:**
- `0` = Success (all tests passed)
- `1` = Failure (one or more tests failed)

---

**Created:** October 26, 2025  
**Version:** 1.0.0  
**Tests:** 21 (Full) + 13 (Quick) = 34 total test cases
