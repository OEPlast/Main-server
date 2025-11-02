# Returns & Refunds Backend - Implementation Summary

## Overview

Complete backend implementation of the Returns & Refunds system, tested end-to-end with all workflows validated.

---

## 🎯 Key Changes Summary

### New: Campaign Slugs (Global, Lowercase) — November 2, 2025

- Added `slug` field to `Campaign` model (`src/models/Campaign.ts`):

  - `slug: string` required, unique, lowercase, trimmed, regex `^[a-z0-9-]+$`
  - Unique index on `{ slug: 1 }`
  - Editable after creation (validated on update)

- Admin API updates:

  - Validators (`src/validators/admin/CampaignValidator.ts`): require `slug` on create, optional on update with regex/normalization
  - Service (`src/services/admin/CampaignService.ts`):
    - Create/Update normalize `slug` to lowercase, handle duplicate key (409 'Slug already exists')
    - New `checkSlugAvailability(slug, excludeId?)` returning `{ available: boolean }`
    - Admin list projection now includes `slug`
  - Routes (`src/routes/admin/campaign.ts`): `GET /admin/campaigns/check-slug?slug=...&excludeId=...`
  - Controller (`src/controller/admin/CampaignController.ts`): `checkSlug`

- Public/User API updates:

  - Routes (`src/routes/users/campaigns.ts`): `GET /users/campaigns/slug/:slug` to fetch active campaign by slug with paginated products
  - Validators (`src/validators/users/CampaignValidator.ts`): `slugWithProductsQueryValidator`
  - Controller (`src/controller/users/CampaignController.ts`): `getActiveCampaignBySlug`
  - Service (`src/services/users/CampaignService.ts`): `getActiveCampaignBySlug`

- Migration:

  - Script: `scripts/migrations/backfill-campaign-slugs.ts`
    - Generate slugs from title, normalize, ensure uniqueness with numeric suffix
    - Usage: `ts-node -r tsconfig-paths/register scripts/migrations/backfill-campaign-slugs.ts`

- Rollout Order:
  1. Deploy code changes (slug optional for existing docs; update uses `runValidators: true`)
  2. Run backfill script in staging then production
  3. Rebuild unique index in background if needed
  4. Update admin UI (see Admin Dashboard notes)

### 1. **Database Models**

#### **Return Model** (`src/models/Return.ts`)

- **returnNumber**: Auto-generated in pre-save hook (optional field, not required validation)
- **9 Status States**: `pending`, `approved`, `rejected`, `items_received`, `inspecting`, `inspection_passed`, `inspection_failed`, `completed`, `cancelled`
- **Business Logic**:
  - 7-day return window from `deliveredAt`
  - Status flow: `pending` → `approved` → `items_received` → `inspecting` → `inspection_passed` → `approved` (final) → `completed`
  - Refund only processed at `approved` status (after inspection passes)

#### **Transaction Model** (`src/models/Transaction.ts`)

- **orderId**: Made optional (not all transactions are order payments)
- **returnId**: Added field for return transactions
- **transactionType**: Enum `['order_payment', 'return_refund']` (default: `'order_payment'`)
- **amount**: Validation min:0 - Refunds stored as **positive values** (type indicates it's a refund)

---

### 2. **Services**

#### **returnService.ts**

8 methods implemented:

1. **initiateReturn**: Validates order status, 7-day window, item quantities
2. **getReturns**: Filtering, pagination, population
3. **getReturnById**: Full details with populated fields
4. **updateReturnStatus**: Status transitions, refund amount calculations
5. **cancelReturn**: Only for pending returns
6. **deleteReturn**: Admin cleanup
7. **getReturnsStatistics**: Aggregated metrics

#### **returnTransactionService.ts**

2 methods implemented:

1. **createReturnTransaction**:

   - Generates reference: `REF-{timestamp}-{random}`
   - Stores amount as **positive value** (`Math.abs(amount)`)
   - Sets `transactionType='return_refund'`
   - Links transaction to return via `refundTransaction` field
   - TODO: Paystack refund API integration (placeholder comments)

2. **getReturnTransactions**: Filter by returnId and type

#### **transactionService.ts** (Updated)

- Fixed **13 locations** with `orderId` null checks
- Pattern: `if (isSuccess && transaction.orderId)` before accessing order
- Prevents errors when transaction is a return_refund (no orderId)

---

### 3. **Controllers**

#### **Customer Controller** (`src/controller/returnController.ts`)

4 endpoints:

1. **POST /returns** - Initiate return (validates ownership, 7-day window)
2. **GET /returns** - Get user's returns (auto-filtered by userId)
3. **GET /returns/:id** - Get specific return (ownership check)
4. **POST /returns/:id/cancel** - Cancel pending return only

#### **Admin Controller** (`src/controller/admin/returnController.ts`)

6 endpoints:

1. **GET /admin/returns** - List all returns (filtering, pagination)
2. **GET /admin/returns/statistics** - Aggregated metrics
3. **GET /admin/returns/:id** - Full return details
4. **PATCH /admin/returns/:id/status** - Update status, admin notes
5. **POST /admin/returns/:id/refund** - Process refund:
   - **Critical Fix**: Checks for `status='approved'` (after inspection)
   - **Critical Fix**: Uses `returnData.user._id.toString()` (user is populated)
   - Creates transaction, updates status to `completed`
6. **DELETE /admin/returns/:id** - Delete return

---

### 4. **Validators** (`src/validators/returnValidator.ts`)

6 validators created:

1. **initiateReturnValidator**: Validates orderId, items array, reasons, qty
2. **updateReturnStatusValidator**: Status enum, adminNotes, refundAmount
3. **processRefundValidator**: refundAmount, refundMethod, adminNotes
4. **getReturnsValidator**: Pagination, filters (status, userId, orderId, dates, search)
5. **returnIdValidator**: MongoDB ObjectId validation
6. **getMyReturnsValidator**: Pagination, status filter for customers

#### **TransactionValidator.ts** (Updated)

- **Added `transactionType` field** to `validateTransactionQueryParams`:
  ```typescript
  transactionType: {
    in: ['query'],
    optional: true,
    isIn: {
      options: [['order_payment', 'return_refund']],
    },
  }
  ```

---

### 5. **Routes**

#### **Customer Routes** (`src/routes/users/returns.ts`)

```typescript
POST   /returns              // Initiate return
GET    /returns              // Get my returns
GET    /returns/:id          // Get specific return
POST   /returns/:id/cancel   // Cancel return
```

#### **Admin Routes** (`src/routes/admin/returnRoutes.ts`)

```typescript
GET    /admin/returns/statistics    // Statistics (before /:id to avoid conflicts)
GET    /admin/returns                // List all returns
GET    /admin/returns/:id            // Get specific return
PATCH  /admin/returns/:id/status    // Update status
POST   /admin/returns/:id/refund    // Process refund
DELETE /admin/returns/:id            // Delete return
```

#### **Server Mounts** (`src/server.ts`)

```typescript
app.use('/returns', UserReturnsRoute); // Line 94
app.use('/admin/returns', AdminReturnRoute); // Line 120
```

---

### 6. **Critical Bug Fixes**

#### **Fix #1: Return Number Generation**

- **Issue**: returnNumber was required but not provided during creation
- **Solution**: Made field optional, auto-generated in pre-save hook
- **Location**: `src/models/Return.ts` line 37-40

#### **Fix #2: Refund Workflow Logic**

- **Issue**: Original logic checked for `inspection_passed` status, but workflow set to `approved` after inspection
- **Solution**: Changed refund status check to `['approved']` (comes after inspection)
- **Location**: `src/controller/admin/returnController.ts` line 133

#### **Fix #3: User ObjectId Extraction**

- **Issue**: `returnData.user.toString()` failed - user is a populated object, not ObjectId
- **Solution**: Changed to `returnData.user._id.toString()`
- **Location**: `src/controller/admin/returnController.ts` line 156

#### **Fix #4: Transaction Amount Validation**

- **Issue**: Stored refund as negative value (`-15000`), failed min:0 validation
- **Solution**: Store as positive (`Math.abs(amount)`), `transactionType` indicates it's a refund
- **Location**: `src/services/returnTransactionService.ts` line 54

#### **Fix #5: TransactionType Query Parameter**

- **Issue**: GET `/admin/transactions?transactionType=return_refund` rejected as unknown field
- **Solution**: Added `transactionType` to validator with enum validation
- **Location**: `src/validators/admin/TransactionValidator.ts` line 88-95

#### **Fix #6: Order Null Checks**

- **Issue**: `orderId` could be null for return_refund transactions
- **Solution**: Added 13 null checks: `if (transaction.orderId)` before order operations
- **Location**: `src/services/transactionService.ts` (verifyPayment, handleWebhook)

---

## 🧪 Testing

### **Test File**: `test-returns-quick.js`

**18 Steps Covered**:
1-2. Create admin & customer users in MongoDB (bcrypt hashed passwords)
3-4. Login both users
5-6. Create category & product 7. Create order (handles cart correction) 8. Complete order (direct MongoDB update) 9. Initiate return (customer) 10. View returns (customer) 11. Approve return (initial approval) 12. Mark items received 13. Start inspection 14. Pass inspection 15. **Final approval for refund** (status='approved' again) 16. Process refund (creates transaction, status='completed') 17. Verify transaction (filter by transactionType) 18. Get statistics

**Error Tests**:

- Cancel completed return (correctly fails ✓)
- Duplicate refund (correctly fails ✓)

**Cleanup**:

- Delete return
- Delete product
- Delete category
- Delete admin user (MongoDB)
- Delete customer user (MongoDB)
- Close MongoDB connection

**Result**: ✅ ALL TESTS PASSED

---

## 📊 Status Flow

```
pending
  ↓
approved (initial approval - customer can proceed)
  ↓
items_received (admin confirms receipt)
  ↓
inspecting (admin checking items)
  ↓
inspection_passed (items confirmed defective/valid)
  ↓
approved (FINAL APPROVAL - ready for refund)
  ↓
[REFUND PROCESSED]
  ↓
completed (refund transaction created, return finalized)
```

**Alternative Paths**:

- `pending` → `cancelled` (customer cancels)
- `pending` → `rejected` (admin rejects)
- `inspecting` → `inspection_failed` → `rejected`

---

## 🔒 Business Rules

1. **Return Window**: 7 days from `deliveredAt`
2. **Order Status**: Must be `Completed` (delivered)
3. **Refund Status**: Only process refund at `approved` (after inspection passes)
4. **Cancellation**: Only `pending` returns can be cancelled by customer
5. **Ownership**: Customers can only access their own returns
6. **Admin Access**: All return management routes require admin role

---

## 🎨 Frontend State (Ready for Phase 3)

### **Schemas** (`apps/isomorphic/src/validators/return-schema.ts`)

- ✅ returnStatusUpdateSchema
- ✅ refundProcessSchema
- ✅ returnFiltersSchema

### **Endpoints** (`apps/isomorphic/src/libs/endpoints.ts`)

```typescript
returns: {
  list: '/returns',
  byId: (id: string) => `/returns/${id}`,
  cancel: (id: string) => `/returns/${id}/cancel`,
  admin: {
    list: '/admin/returns',
    byId: (id: string) => `/admin/returns/${id}`,
    statistics: '/admin/returns/statistics',
    updateStatus: (id: string) => `/admin/returns/${id}/status`,
    processRefund: (id: string) => `/admin/returns/${id}/refund`,
    delete: (id: string) => `/admin/returns/${id}`,
  },
},
```

### **React Query Hooks**

#### **Queries**:

- ✅ `useReturns()` - List returns with filters
- ✅ `useReturnById(id)` - Get specific return
- ✅ `useReturnsStatistics()` - Admin statistics

#### **Mutations**:

- ✅ `useUpdateReturnStatus()` - Admin status updates
- ✅ `useProcessRefund()` - Admin refund processing
- ✅ `useDeleteReturn()` - Admin delete return

**All hooks follow patterns**:

- Multi-layer error handling (hook-level toast + component-level state)
- Accept `UseMutationOptions` for component callbacks
- Automatic query invalidation on success
- Proper TypeScript typing with generics

---

## 📝 Documentation Created

1. **routestotest.md** - Complete API documentation (all 10 endpoints)
2. **TESTING_GUIDE.md** - Testing instructions
3. **TEST_RETURNS_README.md** - Test script documentation
4. **RUN_RETURNS_TEST.md** - Quick start guide
5. **RESTART_SERVER_NOTE.md** - Server restart instructions
6. **BACKEND_CHANGES_SUMMARY.md** (this file)

---

## ✅ Phase 2 Complete

**Backend Status**: ✅ FULLY IMPLEMENTED AND TESTED

**Next Phase**: Phase 3 - Frontend Forms and Pages

### Admin Dashboard Updates (Campaign Slugs)

- Endpoints (`apps/isomorphic/src/libs/endpoints.ts`): `api.campaigns.checkSlug(slug, excludeId?)`
- Schemas (`apps/isomorphic/src/validators/create-campaign.schema.ts`): added `slug`
- Hooks (`apps/isomorphic/src/hooks/queries/useCheckCampaignSlug.ts`): live availability check
- UI:
  - Create/Edit forms include Slug with live availability
  - Campaigns list displays `slug`

**Ready for**:

1. ReturnStatusUpdateForm component
2. RefundProcessForm component
3. Admin pages: `/admin/returns`, `/admin/returns/[id]`
4. Customer pages: `/account/returns`, `/account/returns/[id]`

---

## 🚀 Key Takeaways for Frontend

1. **Status Flow**: Remember the final `approved` status before refund processing
2. **Amount Display**: Transactions store positive amounts, use `transactionType` to determine if refund
3. **Error Handling**: Use multi-layer approach (inline field errors + toast for general errors)
4. **User Populated**: When accessing user from populated return, use `return.user._id` not `return.user`
5. **Filter by Type**: Use `transactionType=return_refund` to filter refund transactions
6. **7-Day Window**: Show countdown/warning if return window is expiring
7. **Status-Based Actions**: Show different actions based on current status (cancel for pending, etc.)

---

**Last Updated**: October 26, 2025  
**Test Status**: ✅ All 18 steps + error tests passing  
**Server Status**: ✅ Running with all routes mounted  
**Documentation**: ✅ Complete
