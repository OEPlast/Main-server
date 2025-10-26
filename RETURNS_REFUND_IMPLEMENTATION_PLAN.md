# Returns & Refund System - Complete Implementation Plan

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Phase 1: Backend Database Models](#phase-1-backend-database-models)
4. [Phase 2: Backend API Implementation](#phase-2-backend-api-implementation)
5. [Phase 3: Admin Frontend](#phase-3-admin-frontend)
6. [Phase 4: Testing & Verification](#phase-4-testing--verification)
7. [File Summary](#file-summary)
8. [Critical Safety Rules](#critical-safety-rules)

---

## Overview

### Goal
Implement a complete returns and refund management system for OEPlast e-commerce platform with separate Return schema, extended Transaction model, and comprehensive admin dashboard.

### Key Features
- ✅ 7-day return window from delivery
- ✅ Multiple return reasons (defective, damaged, wrong item, etc.)
- ✅ Image upload support (string URLs from external service)
- ✅ Admin approval workflow
- ✅ Refund processing with Paystack integration (placeholder)
- ✅ Transaction statistics excluding refunds from revenue
- ✅ Return information displayed on order details

### Tech Stack
**Backend**: Node.js + Express + TypeScript + MongoDB + Mongoose  
**Frontend**: Next.js 15 + React 19 + React Query + Zustand + Rizzui

### Return Window
**7 days** from `order.deliveredAt` (or `order.createdAt` if no delivery date)

---

## Architecture Decisions

### 1. Separate Return Schema (NOT extending Order)
**Rationale**:
- Single Responsibility Principle (orders vs returns)
- Flexible return workflows independent of order status
- Multiple returns per order support
- Easier query performance and indexing
- Clean audit trail

### 2. No Order Model Extension
**Original Plan**: Add `hasReturns` and `totalReturned` to Order model  
**Updated Plan**: Populate returns dynamically in order service

**Rationale**:
- Avoids data redundancy
- Single source of truth (Return model)
- No need to sync `totalReturned` on every refund
- Cleaner data integrity
- More flexible querying

### 3. Transaction Model Extension
**Changes**:
- Add `transactionType` enum: `'order_payment' | 'return_refund'`
- Add optional `returnId` field
- Make `orderId` optional
- Enforce XOR validation (either orderId OR returnId)

**Rationale**:
- Unified transaction tracking
- Revenue vs refund separation
- Clean financial reporting

### 4. Image Upload Strategy
**Accept**: String URLs (single) or string[] (multiple)  
**External Service**: Already implemented image upload service

**Rationale**:
- Separation of concerns
- Reuse existing infrastructure
- No need for file handling in return endpoints

### 5. Paystack Integration
**Strategy**: Placeholder comments with detailed integration steps

**Rationale**:
- Manual implementation by developer
- Complex payment gateway logic
- Requires testing with live credentials

---

## Phase 1: Backend Database Models

### Task 1.1: Create Return Model
**File**: `src/models/Return.ts` *(NEW FILE)*

#### Schema Structure

```typescript
returnItemSchema {
  product: ObjectId (ref: Product, required)
  qty: Number (required, min: 1)
  reason: Enum (required) [
    'defective', 'damaged', 'wrong_item',
    'not_as_described', 'changed_mind', 'other'
  ]
  reasonDetails: String (optional, max: 500 chars)
  images: String[] (optional, image URLs)
  attributes: Array<{ name: String, value: String }>
  refundAmount: Number (optional, set by admin)
  restockingFee: Number (default: 0)
}

returnSchema {
  order: ObjectId (ref: Order, required, indexed)
  user: ObjectId (ref: User, required, indexed)
  returnNumber: String (unique, auto-generated)
  items: returnItemSchema[]
  type: Enum ['refund', 'exchange']
  status: Enum [
    'Requested', 'Pending Review', 'Approved', 'Rejected',
    'Items Received', 'Inspection In Progress',
    'Refund Processed', 'Completed', 'Cancelled'
  ]
  totalRefundAmount: Number (optional, calculated by admin)
  refundMethod: Enum ['original_payment', 'store_credit', 'bank_transfer']
  adminNotes: String (max: 1000 chars)
  customerNotes: String (max: 500 chars)
  returnShipment: {
    carrier: String
    trackingNumber: String
    shippedAt: Date
    receivedAt: Date
  }
  exchangeOrder: ObjectId (ref: Order, optional)
  refundTransaction: ObjectId (ref: Transaction, optional)
  requestedAt: Date (default: now)
  reviewedAt: Date
  approvedAt: Date
  rejectedAt: Date
  itemsReceivedAt: Date
  refundProcessedAt: Date
  completedAt: Date
  reviewedBy: ObjectId (ref: User, admin)
  timestamps: true
}
```

#### Indexes
- `order` (1)
- `user` (1, createdAt: -1)
- `status` (1, createdAt: -1)
- `returnNumber` (1, unique)
- `createdAt` (-1)

#### Pre-save Hook
Generate `returnNumber`: `RET-{timestamp}-{paddedCount}`

#### Implementation Notes
- Use ES6 functional pattern (arrow functions)
- Follow existing model patterns
- Use `mongoose.Schema` and `InferSchemaType`
- Export `ReturnType` and default model

---

### Task 1.2: Extend Transaction Model
**File**: Transaction.ts *(MODIFY EXISTING)*

#### Changes Required

**Add Fields**:
```typescript
transactionType: {
  type: String,
  enum: ['order_payment', 'return_refund'],
  required: true,
  index: true
}

returnId: {
  type: Schema.Types.ObjectId,
  ref: 'Return',
  required: false,
  index: true
}

// Make orderId optional (was required before)
orderId: {
  type: Schema.Types.ObjectId,
  ref: 'Order',
  required: false, // Changed from true
  index: true
}
```

**Add Indexes**:
```typescript
TransactionSchema.index({ returnId: 1 });
TransactionSchema.index({ transactionType: 1 });
```

**Add Pre-save Validation**:
```typescript
TransactionSchema.pre('save', function (next) {
  if (this.transactionType === 'order_payment' && !this.orderId) {
    return next(new Error('orderId is required for order_payment transactions'));
  }
  if (this.transactionType === 'return_refund' && !this.returnId) {
    return next(new Error('returnId is required for return_refund transactions'));
  }
  if (this.transactionType === 'order_payment' && this.returnId) {
    return next(new Error('returnId must be null for order_payment transactions'));
  }
  if (this.transactionType === 'return_refund' && this.orderId) {
    return next(new Error('orderId must be null for return_refund transactions'));
  }
  next();
});
```

#### Safety Rules
- ⚠️ **DO NOT** modify existing fields
- ⚠️ **DO NOT** change existing pre-save hooks
- ⚠️ **ONLY** add new fields and validation
- ⚠️ Test existing transaction creation flows

#### ⚠️ **CRITICAL: Handle Optional orderId**
Since `orderId` becomes optional, **ALL EXISTING CODE** that uses `transaction.orderId` must be updated to handle `undefined`:

**Affected Areas**:
- Transaction service methods
- Transaction controller responses
- Order service (when finding transactions)
- Any aggregation pipelines using `orderId`
- Frontend transaction displays

**Required Changes**:
```typescript
// ❌ BEFORE (will cause TypeScript errors)
const order = await Order.findById(transaction.orderId);
res.json({ orderNumber: transaction.orderId.orderNumber });

// ✅ AFTER (with optional chaining/guards)
const order = transaction.orderId ? await Order.findById(transaction.orderId) : null;
res.json({ 
  orderNumber: transaction.orderId?.orderNumber || null,
  returnNumber: transaction.returnId?.returnNumber || null 
});

// For aggregation pipelines
$lookup: {
  from: "orders",
  localField: "orderId",
  foreignField: "_id",
  as: "order"
}
// No change needed - $lookup handles null/undefined gracefully

// For population
.populate('orderId') // Still works, will populate if exists, null if not
```

---

## Phase 2: Backend API Implementation

⚠️ **CRITICAL PHASE 2 PRIORITY**: Before creating any new files, we MUST audit and fix all existing code that uses `Transaction.orderId` since it becomes optional. This includes:

1. **Find all files** that import or use the Transaction model
2. **Search for** `transaction.orderId`, `t.orderId`, `.orderId` patterns  
3. **Update each usage** with null checks or optional chaining
4. **Add transactionType filters** where transactions are queried by orderId
5. **Test existing transaction endpoints** to ensure they don't break

**Recommended audit command**:
```bash
# Search for orderId usage in JavaScript/TypeScript files
grep -r "\.orderId" src/ --include="*.ts" --include="*.js"
grep -r "orderId:" src/ --include="*.ts" --include="*.js"
```

---

### Task 2.1: Create Return Validator
**File**: `src/validators/returnValidator.ts` *(NEW FILE)*

#### Pattern to Follow
Reference: `src/validators/CouponValidator.ts`

#### Validators Required

**1. initiateReturnValidator**
```typescript
- orderId: required, mongoId
- items: array (min: 1)
- items.*.product: required, mongoId
- items.*.qty: int (min: 1)
- items.*.reason: enum (6 values)
- items.*.reasonDetails: optional, max 500 chars
- items.*.images: optional, array of strings
- items.*.attributes: optional, array
- type: optional, enum ['refund', 'exchange']
- customerNotes: optional, max 500 chars
```

**2. updateReturnStatusValidator**
```typescript
- id: param, required, mongoId
- status: required, enum (9 values)
- adminNotes: optional, max 1000 chars
- refundAmount: optional, float (min: 0)
- restockingFee: optional, float (min: 0)
```

**3. processRefundValidator**
```typescript
- id: param, required, mongoId
- refundAmount: required, float (min: 0)
- refundMethod: required, enum ['original_payment', 'store_credit', 'bank_transfer']
```

**4. getReturnsValidator**
```typescript
- status: optional, enum (9 values)
- userId: optional, mongoId
- orderId: optional, mongoId
- startDate: optional, ISO8601
- endDate: optional, ISO8601
- search: optional, string
- page: optional, int (min: 1)
- limit: optional, int (min: 1, max: 100)
```

**5. returnIdValidator**
```typescript
- id: param, required, mongoId
```

#### Implementation Notes
- Use `express-validator` with `checkSchema`
- Export as object: `export default { initiateReturnValidator, ... }`
- Follow ES6 functional pattern
- No classes

---

### Task 2.2: Create Return Service
**File**: `src/services/returnService.ts` *(NEW FILE)*

#### Pattern to Follow
Reference: `src/services/admin/BannerService.ts`

#### Input Interfaces

```typescript
interface InitiateReturnInput {
  orderId: string;
  userId: string;
  items: Array<{
    product: string;
    qty: number;
    reason: string;
    reasonDetails?: string;
    images?: string[];
    attributes?: Array<{ name: string; value: string }>;
  }>;
  type?: 'refund' | 'exchange';
  customerNotes?: string;
}

interface UpdateReturnStatusInput {
  status: string;
  adminNotes?: string;
  refundAmount?: number;
  restockingFee?: number;
  adminId: string;
}

interface GetReturnsInput {
  status?: string;
  userId?: string;
  orderId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}
```

#### Methods Required

**1. initiateReturn**
```typescript
const initiateReturn = async (
  returnData: InitiateReturnInput
): Promise<CustomResponseType<ReturnType>> => {
  try {
    const { orderId, userId, items, type = 'refund', customerNotes } = returnData;

    // Validate order exists and belongs to user
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return {
        message: 'Order not found or does not belong to user',
        data: null,
        code: 404,
      };
    }

    // Check if order is completed
    if (order.status !== 'Completed') {
      return {
        message: 'Only completed orders can be returned',
        data: null,
        code: 400,
      };
    }

    // Check return window (7 days)
    const returnWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const orderDate = order.deliveredAt || order.createdAt;
    if (Date.now() - orderDate.getTime() > returnWindow) {
      return {
        message: 'Return window has expired (7 days from delivery)',
        data: null,
        code: 400,
      };
    }

    // Validate items exist in order
    for (const item of items) {
      const orderItem = order.products.find(
        (p) => p.product.toString() === item.product
      );
      if (!orderItem) {
        return {
          message: `Product ${item.product} not found in order`,
          data: null,
          code: 400,
        };
      }
      if (item.qty > orderItem.qty) {
        return {
          message: `Cannot return more than purchased quantity for product ${item.product}`,
          data: null,
          code: 400,
        };
      }
    }

    // Create return
    const returnDoc = await Return.create({
      order: orderId,
      user: userId,
      items,
      type,
      customerNotes,
      status: 'Requested',
    });

    return {
      message: 'Return initiated successfully',
      data: returnDoc,
      code: 201,
    };
  } catch (error) {
    console.error('Error initiating return:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to initiate return',
      data: null,
      code: 500,
    };
  }
};
```

**2. getReturns**
```typescript
const getReturns = async (
  searchParams?: GetReturnsInput
): Promise<CustomResponseTypeWithMeta<
  { returns: ReturnType[] },
  { page: number; limit: number; total: number; pages: number }
>> => {
  try {
    const {
      status,
      userId,
      orderId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = searchParams || {};

    // Build query filters
    const filter: Record<string, any> = {};

    if (status) filter.status = status;
    if (userId) filter.user = userId;
    if (orderId) filter.order = orderId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      // Escape regex special chars
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.returnNumber = { $regex: escaped, $options: 'i' };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [returns, total] = await Promise.all([
      Return.find(filter)
        .populate('user', 'firstName lastName email')
        .populate('order', 'total createdAt orderNumber')
        .populate('items.product', 'name images')
        .populate('refundTransaction')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Return.countDocuments(filter),
    ]);

    return {
      message: 'Returns fetched successfully',
      data: { returns },
      code: 200,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    console.error('Error fetching returns:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch returns',
      data: { returns: [] },
      code: 500,
      meta: { page: 1, limit: 0, total: 0, pages: 0 },
    };
  }
};
```

**3. getReturnById**
```typescript
const getReturnById = async (
  id: string, 
  populateAll = false
): Promise<CustomResponseType<ReturnType>> => {
  try {
    const query = Return.findById(id);

    if (populateAll) {
      query
        .populate('user', 'firstName lastName email phoneNumber')
        .populate('order')
        .populate('items.product')
        .populate('refundTransaction')
        .populate('exchangeOrder')
        .populate('reviewedBy', 'firstName lastName email');
    }

    const returnDoc = await query.lean();

    if (!returnDoc) {
      return {
        message: 'Return not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Return fetched successfully',
      data: returnDoc,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching return:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch return',
      data: null,
      code: 500,
    };
  }
};
```

**4. updateReturnStatus**
```typescript
const updateReturnStatus = async (
  id: string, 
  updateData: UpdateReturnStatusInput
): Promise<CustomResponseType<ReturnType>> => {
  try {
    const { status, adminNotes, refundAmount, restockingFee, adminId } = updateData;

    const returnDoc = await Return.findById(id);
    if (!returnDoc) {
      return {
        message: 'Return not found',
        data: null,
        code: 404,
      };
    }

    // Update fields
    returnDoc.status = status as any;
    if (adminNotes) returnDoc.adminNotes = adminNotes;
    
    if (refundAmount !== undefined) {
      returnDoc.totalRefundAmount = refundAmount;
      // Distribute refund amount across items proportionally
      const totalItemsQty = returnDoc.items.reduce((sum, item) => sum + item.qty, 0);
      returnDoc.items.forEach((item) => {
        item.refundAmount = (refundAmount / totalItemsQty) * item.qty;
      });
    }
    
    if (restockingFee !== undefined) {
      const totalItemsQty = returnDoc.items.reduce((sum, item) => sum + item.qty, 0);
      returnDoc.items.forEach((item) => {
        item.restockingFee = (restockingFee / totalItemsQty) * item.qty;
      });
    }

    // Update timestamps based on status
    const now = new Date();
    switch (status) {
      case 'Pending Review':
        returnDoc.reviewedAt = now;
        returnDoc.reviewedBy = new mongoose.Types.ObjectId(adminId) as any;
        break;
      case 'Approved':
        returnDoc.approvedAt = now;
        break;
      case 'Rejected':
        returnDoc.rejectedAt = now;
        break;
      case 'Items Received':
        returnDoc.itemsReceivedAt = now;
        break;
      case 'Refund Processed':
        returnDoc.refundProcessedAt = now;
        break;
      case 'Completed':
        returnDoc.completedAt = now;
        break;
    }

    await returnDoc.save();

    return {
      message: 'Return status updated successfully',
      data: returnDoc,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating return status:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to update return status',
      data: null,
      code: 500,
    };
  }
};
```

**5. cancelReturn**
```typescript
const cancelReturn = async (
  id: string, 
  userId: string
): Promise<CustomResponseType<ReturnType>> => {
  try {
    const returnDoc = await Return.findOne({ _id: id, user: userId });
    if (!returnDoc) {
      return {
        message: 'Return not found or does not belong to user',
        data: null,
        code: 404,
      };
    }

    // Only allow cancellation for certain statuses
    const cancellableStatuses = ['Requested', 'Pending Review'];
    if (!cancellableStatuses.includes(returnDoc.status)) {
      return {
        message: 'Return cannot be cancelled at this stage',
        data: null,
        code: 400,
      };
    }

    returnDoc.status = 'Cancelled';
    await returnDoc.save();

    return {
      message: 'Return cancelled successfully',
      data: returnDoc,
      code: 200,
    };
  } catch (error) {
    console.error('Error cancelling return:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to cancel return',
      data: null,
      code: 500,
    };
  }
};
```

**6. deleteReturn**
```typescript
const deleteReturn = async (id: string): Promise<CustomResponseType<null>> => {
  try {
    const returnDoc = await Return.findByIdAndDelete(id);
    if (!returnDoc) {
      return {
        message: 'Return not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Return deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting return:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to delete return',
      data: null,
      code: 500,
    };
  }
};
```

**7. getReturnStatistics**
```typescript
const getReturnStatistics = async (): Promise<CustomResponseType<{
  totalReturns: number;
  statusBreakdown: Array<{ _id: string; count: number }>;
  recentReturns: ReturnType[];
  totalRefunded: number;
  avgProcessingDays: number;
}>> => {
  try {
    const [
      totalReturns,
      statusBreakdown,
      recentReturns,
      totalRefunded,
    ] = await Promise.all([
      Return.countDocuments(),
      Return.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Return.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'firstName lastName email')
        .populate('order', 'total')
        .lean(),
      Return.aggregate([
        {
          $match: {
            status: { $in: ['Refund Processed', 'Completed'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalRefundAmount' },
          },
        },
      ]),
    ]);

    // Calculate average processing time
    const completedReturns = await Return.find({
      status: 'Completed',
      completedAt: { $exists: true },
    }).lean();

    const avgProcessingTime = completedReturns.reduce((sum, ret) => {
      const diff = ret.completedAt!.getTime() - ret.requestedAt.getTime();
      return sum + diff;
    }, 0) / (completedReturns.length || 1);

    const avgProcessingDays = Math.round(avgProcessingTime / (1000 * 60 * 60 * 24));

    return {
      message: 'Return statistics fetched successfully',
      data: {
        totalReturns,
        statusBreakdown,
        recentReturns,
        totalRefunded: totalRefunded[0]?.total || 0,
        avgProcessingDays,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching return statistics:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch statistics',
      data: {
        totalReturns: 0,
        statusBreakdown: [],
        recentReturns: [],
        totalRefunded: 0,
        avgProcessingDays: 0,
      },
      code: 500,
    };
  }
};
```

**Export Service**
```typescript
const ReturnService = {
  initiateReturn,
  getReturns,
  getReturnById,
  updateReturnStatus,
  cancelReturn,
  deleteReturn,
  getReturnStatistics,
};

export default ReturnService;
```

#### Implementation Notes
- Use arrow functions (NO classes)
- Export as: `export default ReturnService`
- Use `CustomResponseType<T>` and `CustomResponseTypeWithMeta<T, M>` from `@/types`
- Handle errors with try-catch and return structured error responses
- Use `console.error` for error logging (not `console.log`)
- Follow BannerService pattern exactly

---

### Task 2.3: Create Return Transaction Service
**File**: `src/services/returnTransactionService.ts` *(NEW FILE)*

#### Methods Required

**1. createReturnTransaction**
```typescript
interface CreateReturnTransactionInput {
  returnId: string;
  userId: string;
  amount: number;
  refundMethod: string;
  customerInfo: {
    email: string;
    name: string;
    phone?: string;
  };
}

const createReturnTransaction = async (
  transactionData: CreateReturnTransactionInput
): Promise<CustomResponseType<any>> => {
  try {
    const { returnId, userId, amount, refundMethod, customerInfo } = transactionData;

    // Generate reference
    const reference = `REF-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Map refund method to payment gateway
    const gatewayMap: Record<string, string> = {
      original_payment: 'manual', // Will use Paystack integration
      store_credit: 'manual',
      bank_transfer: 'manual',
    };

    // TODO: Paystack Integration
    // ============================
    // When refundMethod === 'original_payment':
    // 1. Fetch original order transaction
    // 2. Get Paystack transaction reference
    // 3. Call Paystack Refund API:
    //    POST https://api.paystack.co/refund
    //    Body: { transaction: originalReference, amount: amountInKobo }
    // 4. Handle response:
    //    - Success: status='completed', store gatewayRefundId
    //    - Pending: status='pending', store gatewayRefundId
    //    - Failure: status='failed', log error
    // 5. Update gatewayResponse with Paystack data
    // ============================

    const transaction = await Transaction.create({
      returnId: new mongoose.Types.ObjectId(returnId),
      userId: new mongoose.Types.ObjectId(userId),
      transactionType: 'return_refund',
      reference,
      amount: -Math.abs(amount), // Negative for refunds
      currency: 'NGN',
      paymentMethod: refundMethod as any,
      paymentGateway: gatewayMap[refundMethod] || 'manual',
      status: 'completed', // TODO: Set based on Paystack response
      customerInfo,
      paymentDate: new Date(),
      paidAt: new Date(),
      // TODO: Add gatewayResponse after Paystack integration
      gatewayResponse: {},
    });

    // Link transaction to return
    await Return.findByIdAndUpdate(returnId, {
      refundTransaction: transaction._id,
    });

    return {
      message: 'Return transaction created successfully',
      data: transaction,
      code: 201,
    };
  } catch (error) {
    console.error('Error creating return transaction:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to create return transaction',
      data: null,
      code: 500,
    };
  }
};
```

**2. getReturnTransactions**
```typescript
const getReturnTransactions = async (
  returnId: string
): Promise<CustomResponseType<any[]>> => {
  try {
    const transactions = await Transaction.find({
      returnId: new mongoose.Types.ObjectId(returnId),
      transactionType: 'return_refund',
    }).lean();

    return {
      message: 'Return transactions fetched successfully',
      data: transactions,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching return transactions:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch return transactions',
      data: [],
      code: 500,
    };
  }
};
```

**Export Service**
```typescript
const ReturnTransactionService = {
  createReturnTransaction,
  getReturnTransactions,
};

export default ReturnTransactionService;
```

#### Implementation Notes
- Use arrow functions (NO classes)
- Export as: `export default { createReturnTransaction, ... }`
- Leave detailed Paystack integration comments
- Use `CustomResponseType` from index.ts

---

### Task 2.4: Update Order Service
**File**: orderService.ts *(MODIFY EXISTING)*

#### Changes Required

**1. Update `getOrderById` method** (both user and admin versions if separate):

**Add return population**:
```typescript
// Option 1: If Order has virtual field for returns
.populate({
  path: 'returns',
  select: '_id returnNumber status type totalRefundAmount requestedAt',
  options: { sort: { createdAt: -1 } }
})

// Option 2: Manual lookup (recommended)
const order = await Order.findById(orderId)
  .populate(...existing populations)
  .lean();

const returns = await Return.find({ order: orderId })
  .select('_id returnNumber status type totalRefundAmount requestedAt')
  .sort({ createdAt: -1 })
  .lean();

return {
  success: true,
  data: { ...order, returns }
};
```

**2. ⚠️ CRITICAL: Fix Existing Methods That Use Transaction.orderId**:

**Check if order service has any transaction-related methods**:

```typescript
// Example: If there's a getOrderWithTransactions method
const getOrderWithTransactions = async (orderId: string) => {
  const order = await Order.findById(orderId);
  
  // ✅ Update to filter by transactionType
  const transactions = await Transaction.find({ 
    orderId,
    transactionType: 'order_payment' // Add this filter
  }).populate('userId');

  return { order, transactions };
};

// Example: If there's a calculateOrderRevenue method
const calculateOrderRevenue = async (orderId: string) => {
  const transactions = await Transaction.find({
    orderId,
    transactionType: 'order_payment', // Only order payments
    status: 'completed'
  });

  // ✅ orderId is guaranteed to exist here due to query filter
  const revenue = transactions.reduce((sum, t) => sum + t.amount, 0);
  return revenue;
};

// Example: If there's a getOrderTransactionHistory method
const getOrderTransactionHistory = async (orderId: string) => {
  const [orderPayments, returns] = await Promise.all([
    Transaction.find({
      orderId,
      transactionType: 'order_payment'
    }).populate('userId'),
    
    // Get return transactions via return documents
    Return.find({ order: orderId })
      .populate({
        path: 'refundTransaction',
        populate: { path: 'userId' }
      })
  ]);

  // Combine and sort by date
  const allTransactions = [
    ...orderPayments,
    ...returns
      .filter(r => r.refundTransaction)
      .map(r => r.refundTransaction)
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return allTransactions;
};
```
```

**Return data structure**:
```typescript
{
  ...orderData,
  returns: [
    {
      _id: string,
      returnNumber: string,
      status: string,
      type: 'refund' | 'exchange',
      totalRefundAmount: number | null,
      requestedAt: Date
    }
  ]
}
```

#### Safety Rules
- ⚠️ **DO NOT** modify existing order fetching logic
- ⚠️ **ONLY** add returns population
- ⚠️ Maintain existing population fields
- ⚠️ Test existing order endpoints after changes

---

### Task 2.5: Create User Return Controller
**File**: `src/controllers/user/returnController.ts` *(NEW FILE)*

#### Methods Required

**1. initiateReturn**
```typescript
- Extract userId from req.user.id
- Validate request body
- Call returnService.initiateReturn
- Return 201 on success, 400 on error
```

**2. getUserReturns**
```typescript
- Extract userId from req.user.id
- Get status, page, limit from query
- Call returnService.getReturns with userId filter
- Return 200 with paginated data
```

**3. getReturnById**
```typescript
- Extract id from params, userId from req.user
- Call returnService.getReturnById(id, true)
- Verify ownership (return.user === userId)
- Return 403 if not owner, 200 if success
```

**4. cancelReturn**
```typescript
- Extract id from params, userId from req.user
- Call returnService.cancelReturn(id, userId)
- Return 200 on success, 400 on error
```

#### Implementation Notes
- Use arrow functions (NO classes)
- Export as: `export default { initiateReturn, ... }`
- Use `validationResult` from express-validator
- Try-catch error handling
- Return standardized responses: `{ success, message?, data?, errors? }`

---

### Task 2.6: Create Admin Return Controller
**File**: `src/controllers/admin/returnController.ts` *(NEW FILE)*

#### Methods Required

**1. getAllReturns**
```typescript
- Validate query params
- Call returnService.getReturns with all filters
- Return 200 with paginated data
```

**2. getReturnById**
```typescript
- Extract id from params
- Call returnService.getReturnById(id, true)
- Return 200 with full return data
```

**3. updateReturnStatus**
```typescript
- Extract id from params, adminId from req.user.id
- Validate body
- Call returnService.updateReturnStatus
- Return 200 on success
```

**4. processRefund**
```typescript
- Extract id from params
- Validate body (refundAmount, refundMethod)
- Get return details
- Check status === 'Approved'
- Call returnTransactionService.createReturnTransaction
- Update return status to 'Refund Processed'
- Calculate and update order's totalReturned (sum of all refunds for that order)
- Return 200 with return and transaction data
```

**5. deleteReturn**
```typescript
- Extract id from params
- Call returnService.deleteReturn
- Return 200 on success
```

**6. getReturnStatistics**
```typescript
- Call returnService.getReturnStatistics
- Return 200 with statistics data
```

#### Implementation Notes
- Use arrow functions (NO classes)
- Export as: `export default { getAllReturns, ... }`
- Use `validationResult` from express-validator
- Try-catch error handling
- Return standardized responses

---

### Task 2.7: Create Return Routes

#### File 1: `src/routes/admin/returnRoutes.ts` *(NEW FILE)*

```typescript
import express from 'express';
import adminReturnController from '../../controllers/admin/returnController';
import { isAuth, isAdmin } from '../../middleware/auth';
import {
  getReturnsValidator,
  returnIdValidator,
  updateReturnStatusValidator,
  processRefundValidator,
} from '../../validators/returnValidator';

const router = express.Router();

router.get('/', isAuth, isAdmin, getReturnsValidator, adminReturnController.getAllReturns);
router.get('/statistics', isAuth, isAdmin, adminReturnController.getReturnStatistics);
router.get('/:id', isAuth, isAdmin, returnIdValidator, adminReturnController.getReturnById);
router.patch('/:id/status', isAuth, isAdmin, updateReturnStatusValidator, adminReturnController.updateReturnStatus);
router.patch('/:id/refund', isAuth, isAdmin, processRefundValidator, adminReturnController.processRefund);
router.delete('/:id', isAuth, isAdmin, returnIdValidator, adminReturnController.deleteReturn);

export default router;
```

#### File 2: `src/routes/user/returnRoutes.ts` *(NEW FILE)*

```typescript
import express from 'express';
import userReturnController from '../../controllers/user/returnController';
import { isAuth } from '../../middleware/auth';
import {
  initiateReturnValidator,
  returnIdValidator,
} from '../../validators/returnValidator';

const router = express.Router();

router.post('/', isAuth, initiateReturnValidator, userReturnController.initiateReturn);
router.get('/', isAuth, userReturnController.getUserReturns);
router.get('/:id', isAuth, returnIdValidator, userReturnController.getReturnById);
router.patch('/:id/cancel', isAuth, returnIdValidator, userReturnController.cancelReturn);

export default router;
```

---

### Task 2.8: Update Transaction Service
**File**: transactionService.ts *(MODIFY EXISTING)*

#### Changes Required

**1. Update `getTransactionStatistics()` method**:

```typescript
const getTransactionStatistics = async () => {
  const [orderPayments, returnRefunds, statusBreakdown] = await Promise.all([
    // Only order_payment transactions
    Transaction.aggregate([
      {
        $match: {
          transactionType: 'order_payment',
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    // Only return_refund transactions
    Transaction.aggregate([
      {
        $match: {
          transactionType: 'return_refund',
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: { $abs: '$amount' } },
          count: { $sum: 1 },
        },
      },
    ]),
    // Status breakdown by type
    Transaction.aggregate([
      {
        $group: {
          _id: { status: '$status', type: '$transactionType' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const revenue = orderPayments[0]?.totalRevenue || 0;
  const refunds = returnRefunds[0]?.totalRefunds || 0;
  const netRevenue = revenue - refunds;

  return {
    totalRevenue: revenue,
    totalRefunds: refunds,
    netRevenue,
    orderPaymentCount: orderPayments[0]?.count || 0,
    returnRefundCount: returnRefunds[0]?.count || 0,
    statusBreakdown,
  };
};
```

**2. Update `getTransactions()` method**:

```typescript
const getTransactions = async (filters: any) => {
  const { transactionType, ...otherFilters } = filters;
  
  const query: any = { ...otherFilters };
  if (transactionType) {
    query.transactionType = transactionType;
  }

  const transactions = await Transaction.find(query)
    .populate({
      path: 'orderId',
      select: 'total createdAt orderNumber',
      match: { _id: { $exists: true } },
    })
    .populate({
      path: 'returnId',
      select: 'returnNumber status totalRefundAmount',
      match: { _id: { $exists: true } },
    })
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .lean();

  return transactions;
};
```

**3. ⚠️ CRITICAL: Fix Existing Methods That Use orderId**:

**Check and update ALL existing transaction service methods**:

```typescript
// Example: If there's a getTransactionsByOrder method
const getTransactionsByOrder = async (orderId: string) => {
  return Transaction.find({ 
    orderId, 
    transactionType: 'order_payment' // Add this filter
  });
};

// Example: If there's a method that accesses orderId directly
const someExistingMethod = async () => {
  const transactions = await Transaction.find({});
  
  // ❌ BEFORE (will break)
  const orderIds = transactions.map(t => t.orderId);
  
  // ✅ AFTER (with null check)
  const orderIds = transactions
    .filter(t => t.orderId) // Filter out null/undefined
    .map(t => t.orderId!); // Non-null assertion since we filtered
    
  // OR with optional chaining
  const orderNumbers = transactions.map(t => t.orderId?.orderNumber).filter(Boolean);
};
```

**4. Update Response Formatting**:

```typescript
// Example: If responses include order information
const formatTransactionResponse = (transaction: any) => {
  return {
    _id: transaction._id,
    reference: transaction.reference,
    amount: transaction.amount,
    status: transaction.status,
    // Handle optional orderId
    order: transaction.orderId ? {
      _id: transaction.orderId._id,
      orderNumber: transaction.orderId.orderNumber,
      total: transaction.orderId.total
    } : null,
    // Handle optional returnId
    return: transaction.returnId ? {
      _id: transaction.returnId._id,
      returnNumber: transaction.returnId.returnNumber,
      status: transaction.returnId.status
    } : null,
    type: transaction.transactionType,
    createdAt: transaction.createdAt
  };
};
```

#### Safety Rules
- ⚠️ **ONLY** modify these 2 methods
- ⚠️ **DO NOT** change method signatures if used elsewhere
- ⚠️ **DO NOT** modify other transaction service methods
- ⚠️ Test existing transaction endpoints after changes

---

### Task 2.9: Update Transaction Controller
**File**: `src/controllers/admin/transactionController.ts` *(MODIFY EXISTING)*

#### Changes Required

**1. Update `getTransactionStatistics` endpoint**:

```typescript
const getTransactionStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await transactionService.getTransactionStatistics();
    
    res.status(200).json({
      success: true,
      data: statistics, // Includes totalRevenue, totalRefunds, netRevenue
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch statistics',
    });
  }
};
```

**2. Update `getAllTransactions` endpoint**:

```typescript
const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const { transactionType, ...otherFilters } = req.query;
    
    const transactions = await transactionService.getTransactions({
      transactionType, // Pass through to service
      ...otherFilters,
    });
    
    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch transactions',
    });
  }
};
```

**3. ⚠️ CRITICAL: Fix Existing Endpoints That Use orderId**:

**Check and update ALL existing transaction controller methods**:

```typescript
// Example: If there's a getTransactionById endpoint
const getTransactionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id)
      .populate('orderId')
      .populate('returnId')
      .populate('userId');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // ✅ Handle optional orderId and returnId
    const response = {
      ...transaction.toObject(),
      order: transaction.orderId ? {
        _id: transaction.orderId._id,
        orderNumber: transaction.orderId.orderNumber || 'N/A',
        total: transaction.orderId.total || 0
      } : null,
      return: transaction.returnId ? {
        _id: transaction.returnId._id,
        returnNumber: transaction.returnId.returnNumber || 'N/A',
        status: transaction.returnId.status
      } : null
    };

    res.status(200).json({
      success: true,
      data: response
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch transaction'
    });
  }
};

// Example: If there's a getTransactionsByOrder endpoint
const getTransactionsByOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    
    const transactions = await Transaction.find({ 
      orderId,
      transactionType: 'order_payment' // Ensure only order transactions
    }).populate('userId');

    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch transactions'
    });
  }
};
```

#### Safety Rules
- ⚠️ **ONLY** modify these 2 endpoints
- ⚠️ **DO NOT** change response format if frontend depends on it
- ⚠️ **DO NOT** modify other transaction controller methods
- ⚠️ Test existing transaction endpoints after changes

---

### Task 2.10: Register Return Routes

#### File 1: Admin Routes Index
**File**: `src/routes/admin/index.ts` *(MODIFY EXISTING)*

**Add**:
```typescript
export { default as AdminReturnRoute } from './returnRoutes';
```

#### File 2: User Routes Index
**File**: `src/routes/user/index.ts` *(CHECK IF EXISTS, CREATE IF NOT)*

**Add**:
```typescript
export { default as UserReturnRoute } from './returnRoutes';
```

#### File 3: Server Registration
**File**: server.ts *(MODIFY EXISTING)*

**Find user routes section** (after '/myorder' or similar):
```typescript
app.use('/returns', UserReturnRoute);
```

**Find admin routes section** (after '/admin/transactions' or similar):
```typescript
app.use('/admin/returns', AdminReturnRoute);
```

#### Safety Rules
- ⚠️ **ONLY** add these 2 lines
- ⚠️ **DO NOT** modify existing route registrations
- ⚠️ **DO NOT** change route order unless necessary
- ⚠️ Maintain consistent pattern with existing routes

---

## Phase 3: Admin Frontend

**Form Management Pattern**: Follow `product-form.tsx` architecture with `react-hook-form` + `zodResolver` + `Controller` + `VerticalFormBlockWrapper` + backend error integration.

### Task 3.1: Create Validation Schemas

#### File: `apps/isomorphic/src/validators/return-schema.ts` *(NEW FILE)*

```typescript
import { z } from 'zod';

// Return status update schema
export const returnStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'completed']),
  adminNotes: z.string().min(1, 'Admin notes are required when updating status').max(500, 'Notes must be less than 500 characters'),
});

export type ReturnStatusUpdateInput = z.infer<typeof returnStatusUpdateSchema>;

// Refund process schema
export const refundProcessSchema = z.object({
  refundMethod: z.enum(['original_payment', 'store_credit', 'bank_transfer']),
  refundAmount: z.number().positive('Refund amount must be positive'),
  adminNotes: z.string().min(1, 'Admin notes are required for refund processing').max(500, 'Notes must be less than 500 characters'),
});

export type RefundProcessInput = z.infer<typeof refundProcessSchema>;

// Return filters schema for search/filtering
export const returnFiltersSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'completed']).optional(),
  returnType: z.enum(['refund', 'exchange']).optional(),
  reason: z.string().optional(),
  dateRange: z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }).optional(),
  searchTerm: z.string().optional(),
});

export type ReturnFiltersInput = z.infer<typeof returnFiltersSchema>;
```

---

### Task 3.2: Update Endpoints
**File**: `src/libs/endpoints.ts` *(MODIFY EXISTING)*

#### Add Returns Endpoints

```typescript
export const api = {
  // ...existing endpoints...
  
  returns: {
    list: '/admin/returns',
    statistics: '/admin/returns/statistics',
    byId: (id: string) => `/admin/returns/${id}`,
    updateStatus: (id: string) => `/admin/returns/${id}/status`,
    processRefund: (id: string) => `/admin/returns/${id}/refund`,
    delete: (id: string) => `/admin/returns/${id}`,
  },
  
  // Update transactions if needed (add transactionType filter support)
  transactions: {
    list: '/admin/transactions', // Already supports ?transactionType=
    statistics: '/admin/transactions/statistics',
    // ...existing
  },
  
  // ...rest of endpoints...
} as const;
```

#### Safety Rules
- ⚠️ **ONLY** add returns section
- ⚠️ **DO NOT** modify existing endpoint paths
- ⚠️ **DO NOT** remove any existing endpoints

---

### Task 3.2: Update Endpoints
**File**: `src/libs/endpoints.ts` *(MODIFY EXISTING)*

#### Add Returns Endpoints

```typescript
export const api = {
  // ...existing endpoints...
  
  returns: {
    list: '/admin/returns',
    statistics: '/admin/returns/statistics',
    byId: (id: string) => `/admin/returns/${id}`,
    updateStatus: (id: string) => `/admin/returns/${id}/status`,
    processRefund: (id: string) => `/admin/returns/${id}/refund`,
    delete: (id: string) => `/admin/returns/${id}`,
  },
  
  // Update transactions if needed (add transactionType filter support)
  transactions: {
    list: '/admin/transactions', // Already supports ?transactionType=
    statistics: '/admin/transactions/statistics',
    // ...existing
  },
  
  // ...rest of endpoints...
} as const;
```

#### Safety Rules
- ⚠️ **ONLY** add returns section
- ⚠️ **DO NOT** modify existing endpoint paths
- ⚠️ **DO NOT** remove any existing endpoints

---

### Task 3.3: Create Return Query Hooks

#### File 1: `src/hooks/queries/useReturns.ts` *(NEW FILE)*

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/libs/axios';
import api from '@/libs/endpoints';

export interface Return {
  _id: string;
  returnNumber: string;
  order: {
    _id: string;
    total: number;
    createdAt: string;
  };
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  items: Array<{
    product: {
      _id: string;
      name: string;
      images: string[];
    };
    qty: number;
    reason: string;
    reasonDetails?: string;
    images?: string[];
    refundAmount?: number;
  }>;
  type: 'refund' | 'exchange';
  status: string;
  totalRefundAmount: number | null;
  customerNotes?: string;
  adminNotes?: string;
  requestedAt: string;
  createdAt: string;
}

export interface ReturnsFilters {
  status?: string;
  userId?: string;
  orderId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const useReturns = (filters: ReturnsFilters = {}) => {
  return useQuery({
    queryKey: ['returns', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });
      
      const response = await apiClient.get<Return[]>(`${api.returns.list}?${params}`);
      return response.data!;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
```

#### File 2: `src/hooks/queries/useReturnById.ts` *(NEW FILE)*

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/libs/axios';
import api from '@/libs/endpoints';
import { Return } from './useReturns';

export const useReturnById = (id: string) => {
  return useQuery<Return>({
    queryKey: ['return', id],
    queryFn: async () => {
      const response = await apiClient.get<Return>(api.returns.byId(id));
      return response.data!;
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};
```

---

### Task 3.4: Create Return Mutation Hooks

#### File 1: `src/hooks/mutations/useUpdateReturnStatus.ts` *(NEW FILE)*

```typescript
'use client';

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { apiClient, handleApiError } from '@/libs/axios';
import api from '@/libs/endpoints';
import toast from 'react-hot-toast';
import { ReturnStatusUpdateInput } from '@/validators/return-schema';

type MutationContext = {
  previousReturn?: any;
};

export const useUpdateReturnStatus = (
  returnId: string,
  options?: Omit<UseMutationOptions<any, Error, ReturnStatusUpdateInput, MutationContext>, 'mutationFn'>
) => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, ReturnStatusUpdateInput, MutationContext>({
    mutationFn: async (data: ReturnStatusUpdateInput) => {
      const response = await apiClient.patch(api.returns.updateStatus(returnId), data);
      if (!response.data) {
        throw new Error('No data returned');
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['return', returnId] });
      toast.success('Return status updated successfully');
      // Allow component to override/extend success handler
      options?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      // Default error toast
      const errorMessage = handleApiError(error);
      toast.error(errorMessage);
      console.error('Update return status error:', error);
      // Allow component to override/extend error handler
      options?.onError?.(error, variables, context);
    },
    ...options,
  });
};
```

#### File 2: `src/hooks/mutations/useProcessRefund.ts` *(NEW FILE)*

```typescript
'use client';

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { apiClient, handleApiError } from '@/libs/axios';
import api from '@/libs/endpoints';
import toast from 'react-hot-toast';
import { RefundProcessInput } from '@/validators/return-schema';

type MutationContext = {
  previousReturn?: any;
};

export const useProcessRefund = (
  returnId: string,
  options?: Omit<UseMutationOptions<any, Error, RefundProcessInput, MutationContext>, 'mutationFn'>
) => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, RefundProcessInput, MutationContext>({
    mutationFn: async (data: RefundProcessInput) => {
      const response = await apiClient.post(api.returns.processRefund(returnId), data);
      if (!response.data) {
        throw new Error('No data returned');
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['return', returnId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Refund processed successfully');
      // Allow component to override/extend success handler
      options?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      // Default error toast
      const errorMessage = handleApiError(error);
      toast.error(errorMessage);
      console.error('Process refund error:', error);
      // Allow component to override/extend error handler
      options?.onError?.(error, variables, context);
    },
    ...options,
  });
};
```

---

### Task 3.5: Create Form Components (Following product-form.tsx Pattern)

#### File 1: `src/app/shared/returns/ReturnStatusUpdateForm.tsx` *(NEW FILE)*

```typescript
'use client';

import { Controller } from 'react-hook-form';
import { Button, Select, Textarea, Alert } from 'rizzui';
import { useState, useEffect } from 'react';
import { Form } from '@core/ui/form';
import { returnStatusUpdateSchema, ReturnStatusUpdateInput } from '@/validators/return-schema';
import VerticalFormBlockWrapper from '@/app/shared/VerticalFormBlockWrapper';
import { useUpdateReturnStatus } from '@/hooks/mutations/useUpdateReturnStatus';
import { BackendValidationError } from '@/libs/form-errors';
import { handleApiError } from '@/libs/axios';

interface ReturnStatusUpdateFormProps {
  returnId: string;
  currentStatus: string;
  onSuccess?: () => void;
  isModalView?: boolean;
}

const statusOptions = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
];

export default function ReturnStatusUpdateForm({
  returnId,
  currentStatus,
  onSuccess,
  isModalView = false,
}: ReturnStatusUpdateFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [apiErrors, setApiErrors] = useState<BackendValidationError[] | null>(null);

  const updateMutation = useUpdateReturnStatus(returnId, {
    onSuccess: () => {
      setFormError(null);
      setApiErrors(null);
      onSuccess?.();
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      setFormError(errorMessage);
      
      // Extract backend validation errors
      if (error?.response?.data?.errors) {
        setApiErrors(error.response.data.errors);
      } else {
        setApiErrors(null);
      }
    },
  });

  const handleSubmit = (data: ReturnStatusUpdateInput) => {
    setFormError(null);
    setApiErrors(null);
    updateMutation.mutate(data);
  };

  return (
    <Form<ReturnStatusUpdateInput>
      validationSchema={returnStatusUpdateSchema}
      onSubmit={handleSubmit}
      useFormProps={{
        mode: 'onSubmit',
        defaultValues: {
          status: currentStatus as any,
          adminNotes: '',
        },
      }}
      className="flex flex-grow flex-col @container [&_label]:font-medium"
    >
      {({
        control,
        formState: { errors, isSubmitting },
        setError,
      }) => {
        // Set backend errors when apiErrors changes
        useEffect(() => {
          if (apiErrors && apiErrors.length > 0) {
            apiErrors.forEach((error) => {
              if (error.path && error.msg) {
                setError(error.path as any, {
                  type: 'manual',
                  message: error.msg,
                });
              }
            });
          }
        }, [apiErrors, setError]);

        return (
          <>
            <div className="flex-grow pb-6">
              {/* Display form-level error */}
              {formError && (
                <Alert color="danger" className="mb-6">
                  <strong>Update failed:</strong> {formError}
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-6 divide-y divide-dashed divide-gray-200">
                {/* Status Selection */}
                <VerticalFormBlockWrapper
                  title="Return Status"
                  description="Select the new status for this return request"
                >
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select
                        options={statusOptions}
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.status?.message as string}
                        getOptionValue={(option) => option.value}
                        placeholder="Select status..."
                      />
                    )}
                  />
                </VerticalFormBlockWrapper>

                {/* Admin Notes */}
                <VerticalFormBlockWrapper
                  title="Admin Notes"
                  description="Add notes explaining the status change"
                  className="pt-6"
                >
                  <Controller
                    name="adminNotes"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        placeholder="Explain the reason for this status change..."
                        rows={4}
                        error={errors.adminNotes?.message as string}
                      />
                    )}
                  />
                </VerticalFormBlockWrapper>
              </div>
            </div>

            {/* Submit Button */}
            <div className={`sticky bottom-0 z-40 flex items-center justify-end gap-3 bg-gray-0/10 backdrop-blur ${
              isModalView ? '-mx-6 -mb-6 px-6 py-4' : 'border-t border-gray-200 py-4'
            }`}>
              <Button
                type="submit"
                isLoading={updateMutation.isPending || isSubmitting}
                disabled={updateMutation.isPending || isSubmitting}
                className="w-full @lg:w-auto"
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
}
```

#### File 2: `src/app/shared/returns/RefundProcessForm.tsx` *(NEW FILE)*

```typescript
'use client';

import { Controller } from 'react-hook-form';
import { Button, Select, Input, Textarea, Alert } from 'rizzui';
import { useState, useEffect } from 'react';
import { Form } from '@core/ui/form';
import { refundProcessSchema, RefundProcessInput } from '@/validators/return-schema';
import VerticalFormBlockWrapper from '@/app/shared/VerticalFormBlockWrapper';
import { useProcessRefund } from '@/hooks/mutations/useProcessRefund';
import { BackendValidationError } from '@/libs/form-errors';
import { handleApiError } from '@/libs/axios';

interface RefundProcessFormProps {
  returnId: string;
  maxRefundAmount: number;
  onSuccess?: () => void;
  isModalView?: boolean;
}

const refundMethodOptions = [
  { value: 'original_payment', label: 'Original Payment Method' },
  { value: 'store_credit', label: 'Store Credit' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export default function RefundProcessForm({
  returnId,
  maxRefundAmount,
  onSuccess,
  isModalView = false,
}: RefundProcessFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [apiErrors, setApiErrors] = useState<BackendValidationError[] | null>(null);

  const refundMutation = useProcessRefund(returnId, {
    onSuccess: () => {
      setFormError(null);
      setApiErrors(null);
      onSuccess?.();
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      setFormError(errorMessage);
      
      // Extract backend validation errors
      if (error?.response?.data?.errors) {
        setApiErrors(error.response.data.errors);
      } else {
        setApiErrors(null);
      }
    },
  });

  const handleSubmit = (data: RefundProcessInput) => {
    setFormError(null);
    setApiErrors(null);
    refundMutation.mutate(data);
  };

  return (
    <Form<RefundProcessInput>
      validationSchema={refundProcessSchema}
      onSubmit={handleSubmit}
      useFormProps={{
        mode: 'onSubmit',
        defaultValues: {
          refundMethod: 'original_payment',
          refundAmount: maxRefundAmount,
          adminNotes: '',
        },
      }}
      className="flex flex-grow flex-col @container [&_label]:font-medium"
    >
      {({
        register,
        control,
        formState: { errors, isSubmitting },
        setError,
      }) => {
        // Set backend errors when apiErrors changes
        useEffect(() => {
          if (apiErrors && apiErrors.length > 0) {
            apiErrors.forEach((error) => {
              if (error.path && error.msg) {
                setError(error.path as any, {
                  type: 'manual',
                  message: error.msg,
                });
              }
            });
          }
        }, [apiErrors, setError]);

        return (
          <>
            <div className="flex-grow pb-6">
              {/* Display form-level error */}
              {formError && (
                <Alert color="danger" className="mb-6">
                  <strong>Refund processing failed:</strong> {formError}
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-6 divide-y divide-dashed divide-gray-200">
                {/* Refund Method */}
                <VerticalFormBlockWrapper
                  title="Refund Method"
                  description="Choose how to process the refund"
                >
                  <Controller
                    name="refundMethod"
                    control={control}
                    render={({ field }) => (
                      <Select
                        options={refundMethodOptions}
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.refundMethod?.message as string}
                        getOptionValue={(option) => option.value}
                      />
                    )}
                  />
                </VerticalFormBlockWrapper>

                {/* Refund Amount */}
                <VerticalFormBlockWrapper
                  title="Refund Amount"
                  description={`Maximum refund amount: ₦${maxRefundAmount.toLocaleString()}`}
                  className="pt-6"
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={maxRefundAmount}
                    placeholder="0.00"
                    {...register('refundAmount', { valueAsNumber: true })}
                    error={errors.refundAmount?.message as string}
                  />
                </VerticalFormBlockWrapper>

                {/* Admin Notes */}
                <VerticalFormBlockWrapper
                  title="Processing Notes"
                  description="Add notes about the refund process"
                  className="pt-6"
                >
                  <Controller
                    name="adminNotes"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        placeholder="Add notes about refund processing..."
                        rows={4}
                        error={errors.adminNotes?.message as string}
                      />
                    )}
                  />
                </VerticalFormBlockWrapper>
              </div>
            </div>

            {/* Submit Button */}
            <div className={`sticky bottom-0 z-40 flex items-center justify-end gap-3 bg-gray-0/10 backdrop-blur ${
              isModalView ? '-mx-6 -mb-6 px-6 py-4' : 'border-t border-gray-200 py-4'
            }`}>
              <Button
                type="submit"
                isLoading={refundMutation.isPending || isSubmitting}
                disabled={refundMutation.isPending || isSubmitting}
                className="w-full @lg:w-auto"
                color="success"
              >
                {refundMutation.isPending ? 'Processing...' : 'Process Refund'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
}
```

---

### Task 3.6: Create Additional UI Components
  return useQuery<{
    returns: Return[];
    total: number;
    page: number;
    pages: number;
  }>({
    queryKey: ['returns', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
      
      const response = await apiClient.get<{
        returns: Return[];
        total: number;
        page: number;
        pages: number;
      }>(`${api.returns.list}?${params.toString()}`);
      
      if (!response.data) {
        throw new Error('No data returned');
      }
      return response.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};
```

#### File 2: `src/hooks/queries/useReturnById.ts` *(NEW FILE)*

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/libs/axios';
import api from '@/libs/endpoints';
import { Return } from './useReturns';

export const useReturnById = (id: string) => {
  return useQuery<Return>({
    queryKey: ['return', id],
    queryFn: async () => {
      const response = await apiClient.get<Return>(api.returns.byId(id));
      if (!response.data) {
        throw new Error('No data returned');
      }
      return response.data;
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });
};
```

#### File 3: `src/hooks/queries/useReturnsStatistics.ts` *(NEW FILE)*

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/libs/axios';
import api from '@/libs/endpoints';

export interface ReturnsStatistics {
  totalReturns: number;
  statusBreakdown: Array<{
    _id: string;
    count: number;
  }>;
  recentReturns: Array<{
    _id: string;
    returnNumber: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
    order: {
      total: number;
    };
    status: string;
    totalRefundAmount: number | null;
    createdAt: string;
  }>;
  totalRefunded: number;
  avgProcessingDays: number;
}

export const useReturnsStatistics = () => {
  return useQuery<ReturnsStatistics>({
    queryKey: ['returns', 'statistics'],
    queryFn: async () => {
      const response = await apiClient.get<ReturnsStatistics>(api.returns.statistics);
      if (!response.data) {
        throw new Error('No data returned');
      }
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

---

### Task 3.3: Create Return Mutation Hooks

#### File 1: `src/hooks/mutations/useUpdateReturnStatus.ts` *(NEW FILE)*

```typescript
'use client';

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { apiClient, handleApiError } from '@/libs/axios';
import api from '@/libs/endpoints';
import toast from 'react-hot-toast';

export interface UpdateReturnStatusInput {
  id: string;
  status: string;
  adminNotes?: string;
  refundAmount?: number;
  restockingFee?: number;
}

type MutationContext = {
  previousReturn?: any;
};

export const useUpdateReturnStatus = (
  options?: Omit<
    UseMutationOptions<any, Error, UpdateReturnStatusInput, MutationContext>,
    'mutationFn'
  >
) => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, UpdateReturnStatusInput, MutationContext>({
    mutationFn: async (data: UpdateReturnStatusInput) => {
      const { id, ...body } = data;
      const response = await apiClient.patch(api.returns.updateStatus(id), body);
      if (!response.data) {
        throw new Error('No data returned');
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['return', variables.id] });
      toast.success('Return status updated successfully');
      options?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const errorMessage = handleApiError(error);
      toast.error(errorMessage);
      console.error('Update return status error:', error);
      options?.onError?.(error, variables, context);
    },
    ...options,
  });
};
```

#### File 2: `src/hooks/mutations/useProcessRefund.ts` *(NEW FILE)*

```typescript
'use client';

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { apiClient, handleApiError } from '@/libs/axios';
import api from '@/libs/endpoints';
import toast from 'react-hot-toast';

export interface ProcessRefundInput {
  id: string;
  refundAmount: number;
  refundMethod: 'original_payment' | 'store_credit' | 'bank_transfer';
}

type MutationContext = {
  previousReturn?: any;
};

export const useProcessRefund = (
  options?: Omit<
    UseMutationOptions<any, Error, ProcessRefundInput, MutationContext>,
    'mutationFn'
  >
) => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, ProcessRefundInput, MutationContext>({
    mutationFn: async (data: ProcessRefundInput) => {
      const { id, ...body } = data;
      const response = await apiClient.patch(api.returns.processRefund(id), body);
      if (!response.data) {
        throw new Error('No data returned');
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['return', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Refund processed successfully');
      options?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const errorMessage = handleApiError(error);
      toast.error(errorMessage);
      console.error('Process refund error:', error);
      options?.onError?.(error, variables, context);
    },
    ...options,
  });
};
```

#### File 3: `src/hooks/mutations/useDeleteReturn.ts` *(NEW FILE)*

```typescript
'use client';

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { apiClient, handleApiError } from '@/libs/axios';
import api from '@/libs/endpoints';
import toast from 'react-hot-toast';

type MutationContext = {
  previousReturns?: any;
};

export const useDeleteReturn = (
  options?: Omit<
    UseMutationOptions<void, Error, string, MutationContext>,
    'mutationFn'
  >
) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: async (id: string) => {
      await apiClient.delete(api.returns.delete(id));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success('Return deleted successfully');
      options?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const errorMessage = handleApiError(error);
      toast.error(errorMessage);
      console.error('Delete return error:', error);
      options?.onError?.(error, variables, context);
    },
    ...options,
  });
};
```

---

### Task 3.4: Update Transaction Query Hooks

#### File 1: `src/hooks/queries/useTransactions.ts` *(MODIFY EXISTING - IF EXISTS)*

**Add transactionType filter**:

```typescript
export interface TransactionsFilters {
  // ...existing filters...
  transactionType?: 'order_payment' | 'return_refund'; // ADD THIS
}

export const useTransactions = (filters: TransactionsFilters = {}) => {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
      
      const response = await apiClient.get(`${api.transactions.list}?${params.toString()}`);
      return response.data;
    },
    // ...existing options...
  });
};
```

**⚠️ CRITICAL: Update Transaction Interface** (handle optional orderId):

```typescript
export interface Transaction {
  _id: string;
  reference: string;
  amount: number;
  status: string;
  transactionType: 'order_payment' | 'return_refund';
  // Make orderId optional
  orderId?: {
    _id: string;
    orderNumber: string;
    total: number;
  } | null;
  // Add returnId
  returnId?: {
    _id: string;
    returnNumber: string;
    status: string;
  } | null;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  // ...other fields...
}
```

#### File 2: `src/hooks/queries/useTransactionStatistics.ts` *(MODIFY EXISTING - IF EXISTS)*

**Update return type**:

```typescript
export interface TransactionStatistics {
  totalRevenue: number; // order_payment only
  totalRefunds: number; // return_refund only - ADD THIS
  netRevenue: number;   // revenue - refunds - ADD THIS
  orderPaymentCount: number;
  returnRefundCount: number; // ADD THIS
  statusBreakdown: Array<{
    _id: { status: string; type: string };
    count: number;
  }>;
  // ...other fields...
}

export const useTransactionStatistics = () => {
  return useQuery<TransactionStatistics>({
    queryKey: ['transactions', 'statistics'],
    queryFn: async () => {
      const response = await apiClient.get<TransactionStatistics>(api.transactions.statistics);
      if (!response.data) {
        throw new Error('No data returned');
      }
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
```

---

### Task 3.5: Create Shared Components

#### File 1: `src/components/returns/ReturnStatusBadge.tsx` *(NEW FILE)*

```typescript
import { Badge } from 'rizzui';

export type ReturnStatus =
  | 'Requested'
  | 'Pending Review'
  | 'Approved'
  | 'Rejected'
  | 'Items Received'
  | 'Inspection In Progress'
  | 'Refund Processed'
  | 'Completed'
  | 'Cancelled';

interface ReturnStatusBadgeProps {
  status: ReturnStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusColorMap: Record<ReturnStatus, string> = {
  'Requested': 'info',
  'Pending Review': 'warning',
  'Approved': 'success',
  'Rejected': 'danger',
  'Items Received': 'secondary',
  'Inspection In Progress': 'warning',
  'Refund Processed': 'info',
  'Completed': 'success',
  'Cancelled': 'default',
};

export const ReturnStatusBadge: React.FC<ReturnStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  return (
    <Badge
      color={statusColorMap[status] as any}
      size={size}
      rounded="md"
    >
      {status}
    </Badge>
  );
};
```

#### File 2: `src/components/returns/ReturnReasonBadge.tsx` *(NEW FILE)*

```typescript
import { Badge } from 'rizzui';

export type ReturnReason =
  | 'defective'
  | 'damaged'
  | 'wrong_item'
  | 'not_as_described'
  | 'changed_mind'
  | 'other';

interface ReturnReasonBadgeProps {
  reason: ReturnReason;
  size?: 'sm' | 'md' | 'lg';
}

const reasonColorMap: Record<ReturnReason, string> = {
  'defective': 'danger',
  'damaged': 'warning',
  'wrong_item': 'warning',
  'not_as_described': 'secondary',
  'changed_mind': 'info',
  'other': 'default',
};

const reasonLabelMap: Record<ReturnReason, string> = {
  'defective': 'Defective',
  'damaged': 'Damaged',
  'wrong_item': 'Wrong Item',
  'not_as_described': 'Not As Described',
  'changed_mind': 'Changed Mind',
  'other': 'Other',
};

export const ReturnReasonBadge: React.FC<ReturnReasonBadgeProps> = ({
  reason,
  size = 'md',
}) => {
  return (
    <Badge
      color={reasonColorMap[reason] as any}
      size={size}
      rounded="md"
    >
      {reasonLabelMap[reason]}
    </Badge>
  );
};
```

---

### Task 3.6: Create Returns List Page
**File**: `src/app/(dashboard)/returns/page.tsx` *(NEW FILE)*

**Features**:
- Table with columns: Return Number, User, Order ID, Status, Items Count, Refund Amount, Date, Actions
- Filters: Status dropdown, Date range picker, Search
- Pagination
- Actions: View Details, Delete (ConfirmModal)

**Implementation**:
- Use `useReturns` hook with filter state
- Use `useDeleteReturn` mutation
- Use Rizzui Table, Button, Select, DatePicker, Input
- Use ReturnStatusBadge component
- Client component with `'use client'`

**Route**: `/returns`

---

### Task 3.7: Create Return Details Page
**File**: `src/app/(dashboard)/returns/[id]/page.tsx` *(NEW FILE)*

**Sections**:
1. Return Info Card (return number, user, order)
2. Return Items Table (products, images, reasons, refund amounts)
3. Timeline (Range component for status progression)
4. Actions Section (update status, process refund)
5. Notes Display (customer notes, admin notes)

**Implementation**:
- Use `useReturnById(id)` hook
- Use `useUpdateReturnStatus` mutation
- Use `useProcessRefund` mutation
- Use `getCdnUrl` for images
- Use upload-zone lightbox for image viewing
- Use Range component for timeline
- Client component with `'use client'`
- Async params handling (Next.js 15 pattern)

**Route**: `/returns/[id]`

---

### Task 3.8: Create Returns Statistics Page
**File**: `src/app/(dashboard)/returns/statistics/page.tsx` *(NEW FILE)*

**Sections**:
1. KPI Cards (total returns, pending, approved, refunded amount, avg processing time)
2. Status Breakdown Table
3. Recent Returns Table

**Implementation**:
- Use `useReturnsStatistics` hook
- Use Rizzui Card, Table, Badge
- Client component with `'use client'`
- **NO CHARTS** (skip for now)

**Route**: `/returns/statistics`

---

### Task 3.9: Update Order Details Page
**File**: `src/app/(dashboard)/orders/[id]/page.tsx` *(MODIFY EXISTING)*

**Add Returns Section**:

```typescript
{/* Returns Section */}
{order.returns && order.returns.length > 0 && (
  <Card className="mt-6">
    <Title className="mb-4">Returns & Refunds</Title>
    <div className="space-y-4">
      {order.returns.map((returnItem) => (
        <div key={returnItem._id} className="flex items-center justify-between border-b pb-4 last:border-b-0">
          <div className="space-y-1">
            <Link
              href={`/returns/${returnItem._id}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {returnItem.returnNumber}
            </Link>
            <div className="text-sm text-gray-600">
              Requested: {new Date(returnItem.requestedAt).toLocaleDateString()}
            </div>
            {returnItem.totalRefundAmount && (
              <div className="text-sm font-medium text-gray-900">
                Refund: ${returnItem.totalRefundAmount.toFixed(2)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ReturnStatusBadge status={returnItem.status} size="sm" />
            <Badge color={returnItem.type === 'refund' ? 'warning' : 'info'} size="sm">
              {returnItem.type}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  </Card>
)}
```

**Add Imports**:
```typescript
import { ReturnStatusBadge } from '@/components/returns/ReturnStatusBadge';
import Link from 'next/link';
```

**Update Order Type** (if needed):
```typescript
interface OrderWithReturns extends Order {
  returns?: Array<{
    _id: string;
    returnNumber: string;
    status: string;
    type: 'refund' | 'exchange';
    totalRefundAmount: number | null;
    requestedAt: string;
  }>;
}
```

#### Safety Rules
- ⚠️ **ONLY** add returns section after existing order details
- ⚠️ **DO NOT** modify existing order display logic
- ⚠️ **DO NOT** change order fetching/state management

---

### Task 3.10: Update Transactions List Page
**File**: `src/app/(dashboard)/transactions/page.tsx` *(MODIFY EXISTING)*

**Add**:
1. `transactionType` filter dropdown
2. "Type" column with badge
3. Conditional "Order ID" or "Return ID" display
4. Navigation based on type

**Changes**:
```typescript
// Add filter state
const [transactionType, setTransactionType] = useState<'order_payment' | 'return_refund' | undefined>();

// Update hook call
const { data, isLoading } = useTransactions({
  ...existingFilters,
  transactionType,
});

// Add filter dropdown
<Select
  label="Transaction Type"
  value={transactionType || 'all'}
  onChange={(value) => setTransactionType(value === 'all' ? undefined : value)}
  options={[
    { label: 'All', value: 'all' },
    { label: 'Order Payment', value: 'order_payment' },
    { label: 'Return Refund', value: 'return_refund' },
  ]}
/>

// Update table columns
**Update table columns**
{/* Type Column */}
<Badge color={row.transactionType === 'order_payment' ? 'success' : 'warning'}>
  {row.transactionType === 'order_payment' ? 'Order' : 'Refund'}
</Badge>

{/* ID Column - Handle optional orderId/returnId */}
{row.transactionType === 'order_payment' && row.orderId ? (
  <Link href={`/orders/${row.orderId._id}`}>
    {row.orderId.orderNumber || 'N/A'}
  </Link>
) : row.transactionType === 'return_refund' && row.returnId ? (
  <Link href={`/returns/${row.returnId._id}`}>
    {row.returnId.returnNumber || 'N/A'}
  </Link>
) : (
  <span className="text-gray-400">N/A</span>
)}

{/* Amount Column - Handle negative refunds */}
<span className={row.amount < 0 ? 'text-red-600' : 'text-green-600'}>
  {row.amount < 0 ? '-' : ''}${Math.abs(row.amount).toFixed(2)}
</span>
```

#### Safety Rules
- ⚠️ **ONLY** add type filter and conditional columns
- ⚠️ **DO NOT** modify existing transaction table logic
- ⚠️ **DO NOT** change pagination or other filters

---

### Task 3.11: Update Transaction Statistics Page
**File**: `src/app/(dashboard)/transactions/statistics/page.tsx` *(MODIFY EXISTING)*

**Update KPI Cards**:

```typescript
// Add/update cards
<Card>
  <Text>Total Revenue</Text>
  <Title>${statistics.totalRevenue.toFixed(2)}</Title>
  <Text muted>Order Payments Only</Text>
</Card>

<Card>
  <Text>Total Refunds</Text>
  <Title className="text-red-600">-${statistics.totalRefunds.toFixed(2)}</Title>
  <Text muted>Return Refunds</Text>
</Card>

<Card>
  <Text>Net Revenue</Text>
  <Title className="text-green-600">${statistics.netRevenue.toFixed(2)}</Title>
  <Text muted>Revenue - Refunds</Text>
</Card>
```

**Update Breakdown Table** (if applicable):
- Separate order payment and return refund counts
- Show both transaction types

#### Safety Rules
- ⚠️ **ONLY** update KPI cards and add new metrics
- ⚠️ **DO NOT** modify existing charts (if any)
- ⚠️ **DO NOT** change other statistics logic

---

## Phase 4: Testing & Verification

### Task 4.1: Backend Testing

**Test with Postman/Thunder Client**:

1. **Return Creation**:
   - POST `/returns` with valid order
   - Test 7-day window validation
   - Test invalid order ID
   - Test item quantity validation

2. **Return Status Updates**:
   - PATCH `/admin/returns/:id/status` with different statuses
   - Verify timestamps update correctly
   - Test admin notes

3. **Refund Processing**:
   - PATCH `/admin/returns/:id/refund` for approved return
   - Verify transaction creation
   - Verify negative amount
   - Check order totalReturned calculation

4. **Return Listing**:
   - GET `/returns` with filters (status, date, search)
   - Verify pagination
   - Test user-specific returns

5. **Transaction Statistics**:
   - GET `/admin/transactions/statistics`
   - Verify revenue excludes refunds
   - Verify netRevenue calculation

6. **Order Details**:
   - GET `/admin/orders/:id` or `/myorder/:id`
   - Verify returns array populated correctly

---

### Task 4.2: Admin Frontend Testing

**Test Scenarios**:

1. **Returns List Page**:
   - Load page, verify table renders
   - Test status filter
   - Test date range filter
   - Test search (return number)
   - Test pagination
   - Delete return (verify ConfirmModal)

2. **Return Details Page**:
   - View return details
   - Update status (verify toast + refresh)
   - Process refund (verify amount validation)
   - View image gallery (lightbox)
   - Check timeline progression

3. **Returns Statistics Page**:
   - View KPI cards
   - Verify status breakdown
   - Check recent returns table

4. **Order Details Page**:
   - View order with returns
   - Verify returns section displays
   - Click return link (navigate to return details)

5. **Transactions Page**:
   - Filter by transaction type
   - Verify order ID vs return ID display
   - Navigate to correct detail page

6. **Transaction Statistics Page**:
   - Verify total revenue, refunds, net revenue
   - Check breakdown by type

**Error Handling**:
- Test API errors (display inline + toast)
- Test network errors
- Test validation errors

---

## File Summary

### Backend Files (old-main-server)

#### NEW FILES (6):
1. `src/models/Return.ts`
2. `src/validators/returnValidator.ts`
3. `src/services/returnService.ts`
4. `src/services/returnTransactionService.ts`
5. `src/controllers/user/returnController.ts`
6. `src/controllers/admin/returnController.ts`
7. `src/routes/user/returnRoutes.ts`
8. `src/routes/admin/returnRoutes.ts`

#### MODIFIED FILES (5):
1. Transaction.ts (add transactionType, returnId, validation)
2. orderService.ts (add returns population + **fix orderId usage**)
3. transactionService.ts (update statistics, list methods + **fix orderId usage**)
4. `src/controllers/admin/transactionController.ts` (update endpoints + **fix orderId usage**)
5. `src/routes/admin/index.ts` (export AdminReturnRoute)
6. `src/routes/user/index.ts` (export UserReturnRoute - if exists)
7. server.ts (register routes)
8. **ALL OTHER FILES** that use `Transaction.orderId` (must be audited and fixed)

**Total Backend: 11+ files** (exact number depends on how many files use orderId)

---

### Admin Frontend Files (oep-web-admin)

#### NEW FILES (11):
1. `src/hooks/queries/useReturns.ts`
2. `src/hooks/queries/useReturnById.ts`
3. `src/hooks/queries/useReturnsStatistics.ts`
4. `src/hooks/mutations/useUpdateReturnStatus.ts`
5. `src/hooks/mutations/useProcessRefund.ts`
6. `src/hooks/mutations/useDeleteReturn.ts`
7. `src/components/returns/ReturnStatusBadge.tsx`
8. `src/components/returns/ReturnReasonBadge.tsx`
9. `src/app/(dashboard)/returns/page.tsx`
10. `src/app/(dashboard)/returns/[id]/page.tsx`
11. `src/app/(dashboard)/returns/statistics/page.tsx`

#### MODIFIED FILES (4):
1. `src/libs/endpoints.ts` (add returns endpoints)
2. `src/hooks/queries/useTransactions.ts` (add transactionType filter - if exists)
3. `src/hooks/queries/useTransactionStatistics.ts` (update return type - if exists)
4. `src/app/(dashboard)/orders/[id]/page.tsx` (add returns section)
5. `src/app/(dashboard)/transactions/page.tsx` (add type filter)
6. `src/app/(dashboard)/transactions/statistics/page.tsx` (update stats)

**Total Admin Frontend: 15 files**

---

### GRAND TOTAL: 26 Files

---

## Critical Safety Rules

#### ⚠️ DO NOT:
1. ❌ Refactor existing code
2. ❌ Modify files outside this plan
3. ❌ Touch existing transaction/order logic beyond specified changes
4. ❌ Change existing API response formats
5. ❌ Remove any existing endpoints
6. ❌ Modify existing component props
7. ❌ Change existing route paths
8. ❌ Alter existing database queries not mentioned
9. ❌ **CRITICAL: Ignore TypeScript errors from optional orderId** - All existing code using `transaction.orderId` must be updated with null checks

#### ✅ DO:
1. ✅ Only create new files or add specified fields
2. ✅ Follow existing code patterns (ES6 functional, React Query, etc.)
3. ✅ Use centralized endpoints (`api` object)
4. ✅ Use `apiClient` for HTTP requests
5. ✅ Accept `UseMutationOptions` in mutation hooks
6. ✅ Multi-layer error handling (inline + toast)
7. ✅ Test after each phase
8. ✅ Verify middleware (`isAuth`, `isAdmin`) works
9. ✅ Use `'use client'` for client components
10. ✅ Handle async params in Next.js 15 pages
11. ✅ **CRITICAL: Add null checks for transaction.orderId** everywhere it's used
12. ✅ **CRITICAL: Add transactionType filters** where transactions are queried by orderId

---

## Pre-Build Checklist

Before starting:
- [ ] Confirmed middleware (`isAuth`, `isAdmin`) exists and works
- [ ] Confirmed Rizzui components (Badge, Table, Modal) available
- [ ] Confirmed upload-zone lightbox component exists
- [ ] Confirmed Range component exists for timeline
- [ ] Confirmed `getCdnUrl` utility exists
- [ ] Backed up database (if in production)
- [ ] Created feature branch in git
- [ ] Reviewed all file paths and locations
- [ ] Understood route registration pattern (index.ts → server.ts)

---

## Execution Order

1. ✅ **Phase 1**: Database models (2 files)
2. ✅ **Phase 2**: Backend API (9 files)
3. ✅ **Phase 3**: Admin Frontend (15 files)
4. ✅ **Phase 4**: Testing

---

## Post-Implementation Tasks

After completing all phases:

1. **Documentation**:
   - Update API documentation (openapi.yaml)
   - Document return window policy
   - Document refund methods

2. **Deployment**:
   - Run database migrations (if needed)
   - Update environment variables
   - Deploy backend
   - Deploy admin frontend
   - Test in staging

3. **Monitoring**:
   - Monitor return creation rate
   - Track refund processing time
   - Watch for error patterns

4. **Future Enhancements**:
   - Integrate Paystack refund API
   - Add email notifications
   - Implement return shipping tracking
   - Add automatic refund approval rules
   - Create return analytics dashboard with charts

---

## 🎯 Ready to Build!

**All tasks defined. All dependencies mapped. All patterns documented.**

This plan is production-ready and safe to execute. Follow it step by step, and you'll have a complete returns & refund system with zero breakage.

**Good luck! 🚀**
