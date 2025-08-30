# Transaction Model Integration & Order Filtering Documentation

## Overview

This document outlines all changes made during the unification of the Payment and Transaction models into a single Transaction model, along with the implementation of transaction status filtering for order retrieval. The changes enhance the system's ability to track payment states and provide filtering capabilities for both admin and user interfaces.

## 🔄 Model Changes

### 1. Transaction Model (Unified)

**File:** `src/models/Transaction.ts` (Previously: Payment.ts)

The unified Transaction model now handles all payment-related operations with enhanced status tracking:

```typescript
enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed', 
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

interface TransactionType {
  _id: string;
  orderId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: TransactionStatus;
  provider: string;
  providerTransactionId: string;
  paymentMethod: string;
  customerInfo: {
    email: string;
    phone?: string;
    name?: string;
  };
  fees?: {
    processingFee: number;
    platformFee: number;
  };
  refunds?: Array<{
    amount: number;
    reason: string;
    refundedAt: Date;
    refundTransactionId?: string;
  }>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Order Model Updates

**File:** `src/models/Order.ts`

The Order model now references the unified Transaction model:

```typescript
// Added field
transactionId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Transaction',
  required: true
}
```

## 📡 API Changes

### User Order Routes

**Base Route:** `/api/users/orders`

#### GET `/api/users/orders` - Get User Order History

**Enhanced Query Parameters:**

```typescript
{
  page?: number;           // Page number (default: 1)
  limit?: number;          // Items per page (default: 10)
  status?: OrderStatus;    // Order status filter
  deliveryStatus?: DeliveryStatus; // Delivery status filter
  transactionStatus?: TransactionStatus | 'all'; // NEW: Transaction status filter
}
```

**Valid Transaction Status Values:**
- `all` - Show orders with any transaction status
- `pending` - Orders with pending payments
- `completed` - Orders with successful payments (DEFAULT)
- `failed` - Orders with failed payments
- `cancelled` - Orders with cancelled payments
- `refunded` - Orders with refunded payments
- `partially_refunded` - Orders with partial refunds

**Default Behavior:**
- If no `transactionStatus` is specified, only orders with `completed` transactions are returned
- This ensures users only see orders they've successfully paid for

**Example Requests:**

```bash
# Get completed orders (default behavior)
GET /api/users/orders

# Get all orders regardless of payment status
GET /api/users/orders?transactionStatus=all

# Get orders with failed payments
GET /api/users/orders?transactionStatus=failed

# Get orders with specific order status and completed payments
GET /api/users/orders?status=shipped&transactionStatus=completed
```

**Response Format:**
```json
{
  "message": "Orders retrieved successfully",
  "data": {
    "orders": [...],
    "totalOrders": 25
  }
}
```

### Admin Order Routes

**Base Route:** `/api/admin/orders`

#### GET `/api/admin/orders` - Get All Orders (Admin)

**Enhanced Query Parameters:**

```typescript
{
  page?: number;           // Page number (default: 1)
  limit?: number;          // Items per page (default: 10)
  status?: OrderStatus;    // Order status filter
  deliveryStatus?: DeliveryStatus; // Delivery status filter
  orderId?: string;        // Specific order ID
  customerId?: string;     // Filter by customer ID
  startDate?: string;      // Date range start (ISO string)
  endDate?: string;        // Date range end (ISO string)
  transactionStatus?: TransactionStatus | 'all'; // NEW: Transaction status filter
}
```

**Example Requests:**

```bash
# Get all orders with completed payments (default)
GET /api/admin/orders

# Get all orders regardless of payment status
GET /api/admin/orders?transactionStatus=all

# Get orders with failed payments for investigation
GET /api/admin/orders?transactionStatus=failed

# Get orders within date range with pending payments
GET /api/admin/orders?startDate=2025-01-01&endDate=2025-01-31&transactionStatus=pending

# Get specific customer's refunded orders
GET /api/admin/orders?customerId=60d5ecb54b24a1a2c8e4e123&transactionStatus=refunded
```

### Transaction Routes

**Base Route:** `/api/transactions` (Previously: `/api/payments`)

All payment routes have been updated to use transaction terminology:

#### POST `/api/transactions/initialize` - Initialize Payment

**Request Body:**
```json
{
  "orderId": "string",     // MongoDB ObjectId
  "amount": "number",      // Amount in base currency unit
  "currency": "string",    // Currency code (e.g., "USD", "NGN")
  "customerEmail": "string",
  "customerName": "string",
  "paymentMethod": "string"
}
```

#### POST `/api/transactions/verify` - Verify Payment

**Request Body:**
```json
{
  "transactionId": "string",    // Our internal transaction ID
  "providerReference": "string" // Payment provider reference
}
```

#### GET `/api/transactions/:transactionId` - Get Transaction Details

**URL Parameters:**
- `transactionId`: MongoDB ObjectId of the transaction

#### GET `/api/user/transactions` - Get User Transactions

**Query Parameters:**
```typescript
{
  page?: number;
  limit?: number;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
}
```

## 🔧 Service Layer Changes

### OrderService Updates

**File:** `src/services/orderService.ts`

The `getOrderHistory` function now includes transaction status filtering:

```typescript
const getOrderHistory = async (
  page: number,
  limit: number,
  filters: { 
    userId: string; 
    status?: OrderType['status']; 
    deliveryStatus?: OrderType['deliveryStatus'];
    transactionStatus?: TransactionStatus | 'all'; // NEW PARAMETER
  }
): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>>
```

**Key Implementation Details:**
- Uses MongoDB aggregation pipeline with `$lookup` to join Transaction data
- Filters orders based on transaction status
- Defaults to showing only `completed` transactions if no filter specified
- Removes transaction data from final response for performance

### Admin Order Service Updates

**File:** `src/services/admin/Order.ts`

The `getOrders` function now supports transaction status filtering:

```typescript
const getOrders = async (
  page?: number,
  limit?: number,
  filters?: Partial<{
    // ... existing filters
    transactionStatus: TransactionStatus | 'all'; // NEW PARAMETER
  }>
): Promise<CustomResponseType<{ orders: OrderType[]; totalOrders: number }>>
```

## 🛡️ Validation Updates

### Order Query Validation

**File:** `src/validators/OrderValidator.ts`

Added new validator for order query parameters:

```typescript
const validateOrderQueryParams = (req: Request, res: Response, next: NextFunction) => {
  // Validates: page, limit, status, deliveryStatus, transactionStatus
}
```

**Valid Values:**
- `transactionStatus`: `'all' | 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded'`

### Admin Order Query Validation

**File:** `src/validators/admin/OrderValidator.ts`

Updated admin validator to include transaction status validation with same valid values as user validator.

## 📋 Controller Updates

### User Order Controller

**File:** `src/controller/orderController.ts`

Updated `getOrders` function to handle `transactionStatus` query parameter:

```typescript
export const getOrders = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, status, deliveryStatus, transactionStatus } = req.query;
  // ... implementation
}
```

### Admin Order Controller

**File:** `src/controller/admin/OrderController.ts`

Updated `getOrders` function to handle `transactionStatus` query parameter:

```typescript
const getOrders = async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 10, 
    // ... existing parameters
    transactionStatus 
  } = req.query;
  // ... implementation
}
```

## 🗂️ File Renames & Refactoring

### Services
- `src/services/PaymentService.ts` → `src/services/TransactionService.ts`
- Updated all method names from `payment*` to `transaction*`

### Validators  
- `src/validators/paymentValidator.ts` → `src/validators/transactionValidator.ts`
- Updated all validation functions to use `transactionId` instead of `paymentId`

### Models
- `src/models/Payment.ts` → `src/models/Transaction.ts` 
- Enhanced with comprehensive transaction status tracking

## 🚀 Usage Examples

### Frontend Integration

```typescript
// Get user's completed orders (default)
const completedOrders = await fetch('/api/users/orders');

// Get all user orders regardless of payment status  
const allOrders = await fetch('/api/users/orders?transactionStatus=all');

// Get failed payment orders for retry
const failedOrders = await fetch('/api/users/orders?transactionStatus=failed');

// Admin: Get orders with pending payments
const pendingPaymentOrders = await fetch('/api/admin/orders?transactionStatus=pending');

// Admin: Get refunded orders for analysis
const refundedOrders = await fetch('/api/admin/orders?transactionStatus=refunded');
```

### Database Queries

The system now performs optimized aggregation queries:

```javascript
// Example aggregation pipeline for transaction filtering
[
  { $match: { user: userId } },
  {
    $lookup: {
      from: 'transactions',
      localField: 'transactionId', 
      foreignField: '_id',
      as: 'transaction'
    }
  },
  { $match: { 'transaction.status': 'completed' } },
  { $sort: { createdAt: -1 } },
  { $skip: (page - 1) * limit },
  { $limit: limit },
  { $project: { transaction: 0 } } // Remove transaction data from response
]
```

## 🔍 Business Logic

### Default Filtering Behavior

**For Users:**
- Default behavior shows only orders with `completed` transactions
- This ensures users only see orders they've successfully paid for
- Users can explicitly request `transactionStatus=all` to see all orders

**For Admins:**
- Default behavior also shows only orders with `completed` transactions
- Admins can filter by any transaction status for management purposes
- Admins can use `transactionStatus=all` to see all orders regardless of payment status

### Transaction Status Meanings

| Status | Description | Use Case |
|--------|-------------|----------|
| `pending` | Payment initiated but not completed | Show orders awaiting payment |
| `completed` | Payment successful | Standard order fulfillment |
| `failed` | Payment attempt failed | Retry payment flow |
| `cancelled` | Payment cancelled by user/system | Order cancellation handling |
| `refunded` | Full refund processed | Customer service |
| `partially_refunded` | Partial refund processed | Partial returns |

## ✅ Testing Recommendations

1. **Verify default behavior**: Orders without `transactionStatus` should only return completed transactions
2. **Test all status filters**: Each transaction status should return appropriate results  
3. **Validate pagination**: Ensure pagination works correctly with transaction filtering
4. **Check permissions**: Users should only see their own orders, admins should see all
5. **Performance testing**: Verify aggregation queries perform well with large datasets

## 🔗 Related Documentation

- [Order Management API](./order-api.md)
- [Transaction Processing Guide](./transaction-guide.md)
- [Admin Dashboard Integration](./admin-integration.md)

---

**Last Updated:** August 30, 2025
**Version:** 2.0.0
**Author:** Development Team
