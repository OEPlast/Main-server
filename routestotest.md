# Returns & Refunds API Routes to Test

## Base URL
```
http://localhost:4000
```

## Authentication
All routes require authentication. Include in headers:
```json
{
  "Authorization": "Bearer <your_token_here>"
}
```

Admin routes also require admin role.

---

## CUSTOMER ROUTES (User-Facing)

### 1. Initiate Return (Customer)
**POST** `/returns`

**Request Body:**
```json
{
  "orderId": "671d5e8f9b8a4c2f5e3d1a2a",
  "items": [
    {
      "product": "671d5e8f9b8a4c2f5e3d1a28",
      "qty": 1,
      "reason": "defective",
      "reasonDetails": "Product stopped working after 2 weeks",
      "images": ["https://example.com/defect1.jpg"]
    }
  ],
  "type": "refund",
  "customerNotes": "Would like a refund please"
}
```

**Validation Rules:**
- `orderId`: Must be valid MongoDB ObjectId
- `items`: Array with at least 1 item
- `items[].product`: Valid MongoDB ObjectId
- `items[].qty`: Integer >= 1
- `items[].reason`: One of: `defective`, `wrong_item`, `not_as_described`, `size_issue`, `quality_issue`, `other`
- `items[].reasonDetails`: Optional, max 500 characters
- `items[].images`: Optional array of strings
- `type`: Optional, one of: `refund`, `exchange` (default: `refund`)
- `customerNotes`: Optional, max 500 characters

**Business Rules:**
- Order must exist and belong to the authenticated user
- Order status must be `Completed` (delivered)
- Must be within 7 days of delivery date
- Items must exist in the order
- Cannot return more quantity than purchased

**Example:**
```bash
POST /returns
Content-Type: application/json
Authorization: Bearer <user_token>

{
  "orderId": "671d5e8f9b8a4c2f5e3d1a2a",
  "items": [
    {
      "product": "671d5e8f9b8a4c2f5e3d1a28",
      "qty": 1,
      "reason": "defective",
      "reasonDetails": "Product malfunctioned"
    }
  ],
  "type": "refund",
  "customerNotes": "Request full refund"
}
```

**Expected Success Response (201):**
```json
{
  "message": "Return initiated successfully",
  "data": {
    "_id": "671d5e8f9b8a4c2f5e3d1a2b",
    "returnNumber": "RTN-1729945234567",
    "order": "671d5e8f9b8a4c2f5e3d1a2a",
    "user": "671d5e8f9b8a4c2f5e3d1a29",
    "items": [...],
    "type": "refund",
    "status": "pending",
    "customerNotes": "Request full refund",
    "requestedAt": "2025-10-26T12:00:00.000Z",
    "createdAt": "2025-10-26T12:00:00.000Z",
    "updatedAt": "2025-10-26T12:00:00.000Z"
  },
  "code": 201
}
```

**Error Scenarios:**
- **404**: Order not found or doesn't belong to user
- **400**: Order not completed yet
- **400**: Return window expired (7 days)
- **400**: Product not in order
- **400**: Quantity exceeds purchased amount

---

### 2. Get My Returns (Customer)
**GET** `/returns`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `status` (optional): Filter by status

**Authorization**: Only returns belonging to authenticated user

**Example:**
```bash
GET /returns?page=1&limit=10&status=pending
Authorization: Bearer <user_token>
```

**Expected Response:**
```json
{
  "message": "Returns retrieved successfully",
  "data": [
    {
      "_id": "671d5e8f9b8a4c2f5e3d1a2b",
      "returnNumber": "RTN-1729945234567",
      "order": {
        "_id": "671d5e8f9b8a4c2f5e3d1a2a",
        "total": 50000
      },
      "items": [...],
      "type": "refund",
      "status": "pending",
      "customerNotes": "Request full refund",
      "requestedAt": "2025-10-26T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  },
  "code": 200
}
```

---

### 3. Get Return by ID (Customer)
**GET** `/returns/:id`

**Path Parameters:**
- `id`: Return MongoDB ObjectId

**Authorization**: Return must belong to authenticated user (403 if not)

**Example:**
```bash
GET /returns/671d5e8f9b8a4c2f5e3d1a2b
Authorization: Bearer <user_token>
```

**Expected Response:**
```json
{
  "message": "Return retrieved successfully",
  "data": {
    "_id": "671d5e8f9b8a4c2f5e3d1a2b",
    "returnNumber": "RTN-1729945234567",
    "order": {
      "_id": "671d5e8f9b8a4c2f5e3d1a2a",
      "total": 50000
    },
    "user": {
      "_id": "671d5e8f9b8a4c2f5e3d1a29",
      "firstName": "John",
      "lastName": "Doe"
    },
    "items": [...],
    "type": "refund",
    "status": "pending",
    "totalRefundAmount": null,
    "customerNotes": "Request full refund",
    "adminNotes": null,
    "requestedAt": "2025-10-26T12:00:00.000Z"
  },
  "code": 200
}
```

**Error Scenarios:**
- **404**: Return not found
- **403**: Return doesn't belong to user

---

### 4. Cancel Return (Customer)
**POST** `/returns/:id/cancel`

**Path Parameters:**
- `id`: Return MongoDB ObjectId

**Authorization**: Return must belong to authenticated user

**Business Rules:**
- Can only cancel returns with status `pending`
- Once approved/rejected/completed, cannot be cancelled

**Example:**
```bash
POST /returns/671d5e8f9b8a4c2f5e3d1a2b/cancel
Authorization: Bearer <user_token>
```

**Expected Response:**
```json
{
  "message": "Return cancelled successfully",
  "data": {
    "_id": "671d5e8f9b8a4c2f5e3d1a2b",
    "returnNumber": "RTN-1729945234567",
    "status": "cancelled",
    "adminNotes": "Cancelled by customer",
    "updatedAt": "2025-10-26T12:30:00.000Z",
    ...
  },
  "code": 200
}
```

**Error Scenarios:**
- **404**: Return not found
- **403**: Return doesn't belong to user
- **400**: Return status is not `pending` (cannot cancel)

---

## ADMIN ROUTES (Admin-Only)

## Return Management Routes

### 1. Get All Returns (Admin)
**GET** `/admin/returns`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (pending, approved, rejected, items_received, inspecting, inspection_passed, inspection_failed, completed, cancelled)
- `userId` (optional): Filter by user ID
- `orderId` (optional): Filter by order ID
- `startDate` (optional): Filter by start date (ISO8601)
- `endDate` (optional): Filter by end date (ISO8601)
- `search` (optional): Search term

**Example:**
```bash
GET /admin/returns?page=1&limit=10&status=pending
```

**Expected Response:**
```json
{
  "message": "Returns retrieved successfully",
  "data": [
    {
      "_id": "...",
      "returnNumber": "RTN-1234567890",
      "order": {
        "_id": "...",
        "total": 50000,
        "createdAt": "2025-10-20T10:00:00.000Z"
      },
      "user": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "items": [...],
      "type": "refund",
      "status": "pending",
      "totalRefundAmount": null,
      "customerNotes": "Product was defective",
      "adminNotes": null,
      "requestedAt": "2025-10-25T10:00:00.000Z",
      "createdAt": "2025-10-25T10:00:00.000Z",
      "updatedAt": "2025-10-25T10:00:00.000Z"
    }
  ],
  "code": 200
}
```

---

### 2. Get Return Statistics (Admin)
**GET** `/admin/returns/statistics`

**No Parameters**

**Example:**
```bash
GET /admin/returns/statistics
```

**Expected Response:**
```json
{
  "message": "Return statistics fetched successfully",
  "data": {
    "total": 150,
    "pending": 25,
    "approved": 40,
    "rejected": 15,
    "completed": 60,
    "cancelled": 10,
    "totalRefundAmount": 500000,
    "averageRefundAmount": 8333.33,
    "byReason": [
      { "reason": "defective", "count": 50 },
      { "reason": "wrong_item", "count": 30 },
      { "reason": "not_as_described", "count": 40 },
      { "reason": "size_issue", "count": 20 },
      { "reason": "quality_issue", "count": 10 }
    ],
    "byType": {
      "refund": 120,
      "exchange": 30
    },
    "recentReturns": 15
  },
  "code": 200
}
```

---

### 3. Get Return by ID (Admin)
**GET** `/admin/returns/:id`

**Path Parameters:**
- `id`: Return MongoDB ObjectId

**Example:**
```bash
GET /admin/returns/671d5e8f9b8a4c2f5e3d1a2b
```

**Expected Response:**
```json
{
  "message": "Return retrieved successfully",
  "data": {
    "_id": "671d5e8f9b8a4c2f5e3d1a2b",
    "returnNumber": "RTN-1234567890",
    "order": {
      "_id": "...",
      "total": 50000,
      "createdAt": "2025-10-20T10:00:00.000Z"
    },
    "user": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "items": [
      {
        "product": {
          "_id": "...",
          "name": "Premium Wireless Headphones",
          "images": ["image1.jpg", "image2.jpg"]
        },
        "qty": 1,
        "reason": "defective",
        "reasonDetails": "Sound cuts out intermittently",
        "images": ["defect-photo1.jpg"],
        "refundAmount": 15000
      }
    ],
    "type": "refund",
    "status": "pending",
    "totalRefundAmount": 15000,
    "customerNotes": "Product stopped working after 2 weeks",
    "adminNotes": null,
    "refundTransaction": null,
    "requestedAt": "2025-10-25T10:00:00.000Z",
    "createdAt": "2025-10-25T10:00:00.000Z",
    "updatedAt": "2025-10-25T10:00:00.000Z"
  },
  "code": 200
}
```

---

### 4. Update Return Status (Admin)
**PATCH** `/admin/returns/:id/status`

**Path Parameters:**
- `id`: Return MongoDB ObjectId

**Request Body:**
```json
{
  "status": "approved",
  "adminNotes": "Return approved. Customer to ship items back."
}
```

**Status Options:**
- `pending` - Initial status
- `approved` - Admin approved the return
- `rejected` - Admin rejected the return
- `items_received` - Items received from customer
- `inspecting` - Items being inspected
- `inspection_passed` - Inspection passed
- `inspection_failed` - Inspection failed
- `completed` - Refund processed and completed
- `cancelled` - Return cancelled

**Example:**
```bash
PATCH /admin/returns/671d5e8f9b8a4c2f5e3d1a2b/status
Content-Type: application/json

{
  "status": "approved",
  "adminNotes": "Return approved after review. Awaiting item shipment."
}
```

**Expected Response:**
```json
{
  "message": "Return status updated successfully",
  "data": {
    "_id": "671d5e8f9b8a4c2f5e3d1a2b",
    "returnNumber": "RTN-1234567890",
    "status": "approved",
    "adminNotes": "Return approved after review. Awaiting item shipment.",
    "updatedAt": "2025-10-26T12:00:00.000Z",
    ...
  },
  "code": 200
}
```

---

### 5. Process Refund (Admin)
**POST** `/admin/returns/:id/refund`

**Path Parameters:**
- `id`: Return MongoDB ObjectId

**Request Body:**
```json
{
  "refundAmount": 15000,
  "refundMethod": "original_payment",
  "adminNotes": "Refund processed via Paystack to original payment method"
}
```

**Refund Method Options:**
- `original_payment` - Refund to original payment method (via Paystack)
- `store_credit` - Issue store credit
- `bank_transfer` - Manual bank transfer

**Prerequisites:**
- Return status must be `approved`
- Return must not have been refunded already

**Example:**
```bash
POST /admin/returns/671d5e8f9b8a4c2f5e3d1a2b/refund
Content-Type: application/json

{
  "refundAmount": 15000,
  "refundMethod": "original_payment",
  "adminNotes": "Full refund processed after inspection"
}
```

**Expected Response:**
```json
{
  "message": "Refund processed successfully",
  "data": {
    "return": {
      "_id": "671d5e8f9b8a4c2f5e3d1a2b",
      "returnNumber": "RTN-1234567890",
      "status": "completed",
      "totalRefundAmount": 15000,
      "refundTransaction": "671d5f9f9b8a4c2f5e3d1a2c",
      ...
    },
    "transaction": {
      "_id": "671d5f9f9b8a4c2f5e3d1a2c",
      "returnId": "671d5e8f9b8a4c2f5e3d1a2b",
      "transactionType": "return_refund",
      "reference": "REF-1729945234567-abc123",
      "amount": -15000,
      "currency": "NGN",
      "paymentMethod": "original_payment",
      "paymentGateway": "manual",
      "status": "completed",
      "paidAt": "2025-10-26T12:00:00.000Z",
      ...
    }
  },
  "code": 200
}
```

---

### 6. Delete Return (Admin)
**DELETE** `/admin/returns/:id`

**Path Parameters:**
- `id`: Return MongoDB ObjectId

**Example:**
```bash
DELETE /admin/returns/671d5e8f9b8a4c2f5e3d1a2b
```

**Expected Response:**
```json
{
  "message": "Return deleted successfully",
  "data": null,
  "code": 200
}
```

---

## Transaction Routes (Updated)

### 7. Get All Transactions with Type Filter
**GET** `/admin/transactions`

**Query Parameters:**
- `transactionType` (optional): Filter by type (`order_payment` or `return_refund`)
- `page`, `limit`, `status`, `userId`, `orderId`, etc.

**Example:**
```bash
GET /admin/transactions?transactionType=return_refund&page=1&limit=10
```

**Expected Response:**
```json
{
  "message": "Transactions retrieved successfully",
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "code": 200
}
```

---

### 8. Get Transaction Statistics (Updated)
**GET** `/admin/transactions/statistics`

**Example:**
```bash
GET /admin/transactions/statistics
```

**Expected Response:**
```json
{
  "message": "Transaction statistics fetched successfully",
  "data": {
    "total": 500,
    "completed": 450,
    "pending": 30,
    "failed": 15,
    "cancelled": 5,
    "refunded": 10,
    "partially_refunded": 5,
    "totalRevenue": 10000000,
    "totalRefunded": 50000,
    "totalReturnRefunds": 150000,
    "netRevenue": 9850000,
    "averageTransactionValue": 22222.22,
    "orderPaymentCount": 450,
    "returnRefundCount": 50,
    "transactionsByGateway": {
      "paystack": 400,
      "manual": 100
    },
    "transactionsByMethod": {
      "card": 350,
      "bank_transfer": 100,
      "store_credit": 50
    },
    "recentTransactions": 25,
    "todayRevenue": 150000,
    "monthlyRevenue": 2500000
  },
  "code": 200
}
```

---

## Testing Workflow

### Complete Customer Return Flow Test

**Prerequisites:**
- Have a regular user account with JWT token
- Have a completed order (delivered) for that user
- Order delivery date within last 7 days

**Customer Flow:**

1. **Customer initiates return**
   ```bash
   POST /returns
   Authorization: Bearer <user_token>
   Body: { orderId, items, type, customerNotes }
   # Expected: 201 Created with return data
   ```

2. **Customer views their returns**
   ```bash
   GET /returns
   Authorization: Bearer <user_token>
   # Expected: 200 with list of user's returns
   ```

3. **Customer views specific return details**
   ```bash
   GET /returns/:returnId
   Authorization: Bearer <user_token>
   # Expected: 200 with full return details
   ```

4. **Customer cancels return (if still pending)**
   ```bash
   POST /returns/:returnId/cancel
   Authorization: Bearer <user_token>
   # Expected: 200, status changed to 'cancelled'
   ```

### Complete Admin Return Flow Test

**Prerequisites:**
- Have admin account with JWT token
- Have at least one return created by customer

**Admin Flow:**

1. **Admin lists all returns**
   ```bash
   GET /admin/returns
   Authorization: Bearer <admin_token>
   # Expected: 200 with all returns (all users)
   ```

2. **Admin views return statistics**
   ```bash
   GET /admin/returns/statistics
   Authorization: Bearer <admin_token>
   # Expected: 200 with aggregated stats
   ```

3. **Admin views specific return**
   ```bash
   GET /admin/returns/:returnId
   Authorization: Bearer <admin_token>
   # Expected: 200 with full return details
   ```

4. **Admin approves return**
   ```bash
   PATCH /admin/returns/:returnId/status
   Authorization: Bearer <admin_token>
   Body: { "status": "approved", "adminNotes": "Approved" }
   # Expected: 200, status changed to 'approved'
   ```

5. **Admin updates to items_received**
   ```bash
   PATCH /admin/returns/:returnId/status
   Body: { "status": "items_received" }
   # Expected: 200
   ```

6. **Admin updates to inspection_passed**
   ```bash
   PATCH /admin/returns/:returnId/status
   Body: { "status": "inspection_passed" }
   # Expected: 200
   ```

7. **Admin processes refund**
   ```bash
   POST /admin/returns/:returnId/refund
   Authorization: Bearer <admin_token>
   Body: {
     "refundAmount": 15000,
     "refundMethod": "original_payment",
     "adminNotes": "Refund processed"
   }
   # Expected: 200, status='completed', transaction created
   ```

8. **Verify refund transaction created**
   ```bash
   GET /admin/transactions?transactionType=return_refund
   Authorization: Bearer <admin_token>
   # Expected: 200 with transaction having negative amount
   ```

9. **Check updated transaction statistics**
   ```bash
   GET /admin/transactions/statistics
   Authorization: Bearer <admin_token>
   # Expected: 200 with totalReturnRefunds, netRevenue calculated
   ```

10. **Admin deletes return (cleanup)**
    ```bash
    DELETE /admin/returns/:returnId
    Authorization: Bearer <admin_token>
    # Expected: 200
    ```

---

## Error Scenarios to Test

### Customer Route Errors

1. **Initiate return for non-existent order:**
   ```bash
   POST /returns
   Body: { "orderId": "000000000000000000000000", ... }
   # Expected: 404 - Order not found
   ```

2. **Initiate return for another user's order:**
   ```bash
   POST /returns
   Body: { "orderId": "<other_user_order_id>", ... }
   # Expected: 404 - Order not found or doesn't belong to user
   ```

3. **Initiate return for non-delivered order:**
   ```bash
   POST /returns
   Body: { "orderId": "<pending_order_id>", ... }
   # Expected: 400 - Only completed orders can be returned
   ```

4. **Initiate return after 7-day window:**
   ```bash
   POST /returns
   Body: { "orderId": "<old_order_id>", ... }
   # Expected: 400 - Return window has expired
   ```

5. **Access another user's return:**
   ```bash
   GET /returns/<other_user_return_id>
   Authorization: Bearer <user_token>
   # Expected: 403 - Access denied
   ```

6. **Cancel non-pending return:**
   ```bash
   POST /returns/<approved_return_id>/cancel
   # Expected: 400 - Only pending returns can be cancelled
   ```

### Admin Route Errors

**Validation Errors:**

1. **Invalid Return ID:**
   ```bash
   GET /admin/returns/invalid-id
   # Expected: 400 with validation error
   ```

2. **Invalid Status:**
   ```bash
   PATCH /admin/returns/:id/status
   Body: { "status": "invalid_status" }
   # Expected: 400 with validation error
   ```

3. **Missing Required Fields:**
   ```bash
   POST /admin/returns/:id/refund
   Body: { "refundAmount": 15000 }
   # Expected: 400 - missing refundMethod
   ```

4. **Refund Before Approval:**
   ```bash
   POST /admin/returns/:id/refund
   # With return status = "pending"
   # Expected: 400 - Return must be approved before processing refund
   ```

5. **Duplicate Refund:**
   ```bash
   POST /admin/returns/:id/refund
   # On already refunded return
   # Expected: 400 - Refund already processed
   ```

**Authorization Errors:**

1. **No Token (Customer Routes):**
   ```bash
   GET /returns
   # Without Authorization header
   # Expected: 401 Unauthorized
   ```

2. **No Token (Admin Routes):**
   ```bash
   GET /admin/returns
   # Without Authorization header
   # Expected: 401 Unauthorized
   ```

3. **Non-Admin User Accessing Admin Routes:**
   ```bash
   GET /admin/returns
   # With regular user token
   # Expected: 403 Forbidden
   ```

---

## Sample Test Data

### Create Test Return (Manual via MongoDB or API if available)

```javascript
{
  "orderId": "671d5e8f9b8a4c2f5e3d1a2a", // Existing order ID
  "userId": "671d5e8f9b8a4c2f5e3d1a29",  // Existing user ID
  "items": [
    {
      "product": "671d5e8f9b8a4c2f5e3d1a28", // Existing product ID
      "qty": 1,
      "reason": "defective",
      "reasonDetails": "Product stopped working",
      "images": ["https://example.com/image1.jpg"],
      "refundAmount": 15000
    }
  ],
  "type": "refund",
  "customerNotes": "Need urgent refund"
}
```

---

## Notes

- All monetary amounts are in kobo (Nigerian currency subunit, 100 kobo = 1 Naira)
- Dates are in ISO8601 format
- Return numbers are auto-generated with pattern: `RTN-{timestamp}-{random}`
- Transaction references for refunds follow pattern: `REF-{timestamp}-{random}`
- The Paystack refund integration is currently a placeholder (marked with TODO comments)
- Negative amounts in transactions indicate refunds

---

## Postman/Thunder Client Collection Tips

1. **Create environment variables:**
   - `baseUrl`: http://localhost:4000
   - `userToken`: Regular user JWT token
   - `adminToken`: Admin user JWT token
   - `testOrderId`: ID of a completed order
   - `testReturnId`: ID of a test return

2. **Test sequence (Customer Flow):**
   - Initiate Return → Get My Returns → Get Return by ID → Cancel Return

3. **Test sequence (Admin Flow):**
   - List All Returns → Statistics → Get by ID → Update Status → Process Refund → Delete

4. **Assertions to add:**
   - Status code checks (200, 201, 400, 401, 403, 404)
   - Response structure validation
   - Data type validation
   - Authorization validation (user can only access own returns)
   - Business logic validation (e.g., refund only after approval, 7-day window)

---

## Quick Test Commands (cURL)

### Customer Routes

```bash
# 1. Customer initiates return
curl -X POST http://localhost:4000/returns \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID",
    "items": [
      {
        "product": "PRODUCT_ID",
        "qty": 1,
        "reason": "defective",
        "reasonDetails": "Product malfunctioned"
      }
    ],
    "type": "refund",
    "customerNotes": "Request refund"
  }'

# 2. Customer gets their returns
curl -X GET "http://localhost:4000/returns?page=1&limit=10" \
  -H "Authorization: Bearer USER_TOKEN"

# 3. Customer gets specific return
curl -X GET http://localhost:4000/returns/RETURN_ID \
  -H "Authorization: Bearer USER_TOKEN"

# 4. Customer cancels return
curl -X POST http://localhost:4000/returns/RETURN_ID/cancel \
  -H "Authorization: Bearer USER_TOKEN"
```

### Admin Routes

```bash
# 1. Admin gets all returns
curl -X GET http://localhost:4000/admin/returns \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 2. Admin gets statistics
curl -X GET http://localhost:4000/admin/returns/statistics \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 3. Admin gets specific return
curl -X GET http://localhost:4000/admin/returns/RETURN_ID \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 4. Admin updates return status
curl -X PATCH http://localhost:4000/admin/returns/RETURN_ID/status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","adminNotes":"Approved after review"}'

# 5. Admin processes refund
curl -X POST http://localhost:4000/admin/returns/RETURN_ID/refund \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refundAmount":15000,"refundMethod":"original_payment","adminNotes":"Refund processed"}'

# 6. Admin deletes return
curl -X DELETE http://localhost:4000/admin/returns/RETURN_ID \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 7. Get return refund transactions
curl -X GET "http://localhost:4000/admin/transactions?transactionType=return_refund" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 8. Get updated transaction statistics
curl -X GET http://localhost:4000/admin/transactions/statistics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**End of Routes to Test**
