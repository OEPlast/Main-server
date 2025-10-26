# Returns & Refunds API Test Simulation

Comprehensive end-to-end test suite for the Returns & Refunds API implementation.

## Overview

This test simulation covers the complete flow from product creation to refund processing, including:

1. **Setup Phase**
   - Admin authentication
   - Product creation
   - Customer registration

2. **Order Phase**
   - Order creation (customer checkout)
   - Payment simulation (order completion)

3. **Return Initiation Phase**
   - Customer initiates return
   - Customer views returns
   - Customer views return details

4. **Admin Management Phase**
   - Admin views all returns
   - Admin views statistics
   - Admin reviews return details
   - Admin approves return
   - Admin marks items as received
   - Admin passes inspection

5. **Refund Processing Phase**
   - Admin processes refund
   - Refund transaction creation
   - Transaction statistics update

6. **Error Scenario Tests**
   - Cancel completed return (should fail)
   - Unauthorized access to returns (should fail)
   - Duplicate refund processing (should fail)
   - Regular user accessing admin routes (should fail)

## Prerequisites

1. **Server Running**
   ```bash
   npm run dev
   ```
   Server should be running on `http://localhost:4000`

2. **Database Connected**
   - MongoDB instance running and connected
   - Database should be clean or in a testable state

3. **Admin Account**
   - An admin account must exist with:
     - Email: `admin@test.com`
     - Password: `Admin123!`
   
   If not, create one manually or update the test credentials in `test-returns-simulation.js`:
   ```javascript
   const testData = {
     admin: { email: 'your-admin@email.com', password: 'YourPassword', ... },
     ...
   };
   ```

## Running the Test

### Option 1: Using npm script
```bash
npm run test:returns
```

### Option 2: Direct execution
```bash
node test-returns-simulation.js
```

### Option 3: With custom API URL
```bash
API_URL=http://localhost:4000 node test-returns-simulation.js
```

## Test Output

### Console Output
The test will output colored logs to the console showing:
- ✓ Successful operations in green
- ✗ Failed operations in red
- ℹ Info messages
- ⚠ Warnings

### Log File
All test results are saved to: `returns-test-simulation.log`

The log file contains:
- Timestamp for each operation
- Request details (method, URL, body)
- Response details (status, message, data)
- Error details (if any)
- Final test summary

### Example Output
```
[2025-10-26T12:00:00.000Z] [INFO] RETURNS & REFUNDS API TEST SIMULATION
[2025-10-26T12:00:00.100Z] [INFO] STEP 1: Admin Authentication
[2025-10-26T12:00:00.200Z] [SUCCESS] ✓ Admin authenticated successfully
[2025-10-26T12:00:00.300Z] [INFO] STEP 2: Create Test Product
[2025-10-26T12:00:00.450Z] [SUCCESS] ✓ Product created successfully
...
[2025-10-26T12:00:30.000Z] [INFO] TEST SUMMARY
  Total Tests: 25
  Successful: 21
  Failed: 0
  Duration: 30000ms
```

## Test Coverage

### Covered Endpoints

**Customer Routes:**
- `POST /returns` - Initiate return
- `GET /returns` - Get user's returns
- `GET /returns/:id` - Get return details
- `POST /returns/:id/cancel` - Cancel return

**Admin Routes:**
- `GET /admin/returns` - Get all returns
- `GET /admin/returns/statistics` - Get statistics
- `GET /admin/returns/:id` - Get return details
- `PATCH /admin/returns/:id/status` - Update status
- `POST /admin/returns/:id/refund` - Process refund
- `DELETE /admin/returns/:id` - Delete return

**Transaction Routes:**
- `GET /admin/transactions?transactionType=return_refund` - Get refund transactions
- `GET /admin/transactions/statistics` - Get transaction statistics

### Business Rules Tested

✅ Order must be completed before return  
✅ Return window validation (7 days)  
✅ Item quantity validation  
✅ Authorization checks (user can only access own returns)  
✅ Status flow validation (pending → approved → items_received → inspection_passed → completed)  
✅ Refund amount calculation  
✅ Transaction creation with negative amount  
✅ Statistics update after refund  
✅ Duplicate refund prevention  
✅ Admin role requirement for admin routes  

## Troubleshooting

### Test Fails at Admin Authentication
- Verify admin account exists with correct credentials
- Check if auth endpoints are working: `POST /auth/login`

### Test Fails at Product Creation
- Ensure admin has permission to create products
- Check if a valid category ID exists (or update the placeholder in the test)

### Test Fails at Order Creation
- Verify checkout endpoint is working: `POST /checkout/secure`
- Check if shipping calculation is configured

### Test Fails at Return Initiation
- Ensure order is marked as "Completed"
- Check if delivery date is within 7 days
- Verify return service is properly configured

### Network Errors
- Confirm server is running on correct port
- Check firewall/network settings
- Verify BASE_URL environment variable

## Customization

### Modify Test Data
Edit the `testData` object in `test-returns-simulation.js`:
```javascript
const testData = {
  admin: { email: 'your-admin@email.com', password: 'password', ... },
  product: { name: 'Custom Product', price: 20000, ... },
  ...
};
```

### Add More Tests
Add new test functions following the pattern:
```javascript
async function testNewScenario() {
  logger.info('TEST: New Scenario');
  
  try {
    // Test code here
    const response = await apiClient.get('/your-endpoint');
    
    logger.success('✓ Test passed', { data: response.data });
    return true;
  } catch (error) {
    logger.error('✗ Test failed', { error: error.message });
    throw error;
  }
}
```

Then call it in `runTests()`:
```javascript
await testNewScenario() && testsPassed++;
```

### Change Log File Location
Modify the `LOG_FILE` constant:
```javascript
const LOG_FILE = path.join(__dirname, 'custom-log-name.log');
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Returns Test Simulation
  run: |
    npm run dev &
    sleep 5
    npm run test:returns
  env:
    API_URL: http://localhost:4000
```

### Exit Codes
- `0` - All tests passed
- `1` - One or more tests failed

## Notes

- The test creates real data in the database
- Test creates a unique customer email each run (timestamp-based)
- The test includes a cleanup step to delete the test return
- Product and order remain in database (for audit purposes)
- Run in a test/development environment, NOT production

## Support

For issues or questions:
1. Check the log file: `returns-test-simulation.log`
2. Verify all prerequisites are met
3. Review the error messages in console output
4. Check the `routestotest.md` for API documentation

---

**Last Updated:** October 26, 2025  
**Test Version:** 1.0.0
