# Shipment and Delivery Update Plan

This plan covers end-to-end backend and admin frontend changes for shipments and the new Delivery flow. It follows the strict route → validator → controller → service pipeline and mirrors existing Shipments UI patterns.

## Goals

- Auto-create a Shipment on successful checkout when deliveryType = 'shipping'.
- Admin can manage shipment meta (courier, courierUser, dimensions, notes).
- Introduce Delivery feature: delivery users manage tracking, notes, and status only.
- Lock down Delivered shipments (no further status/notes/tracking edits).
- Add Shipments Stats API and Shipments stats UI header.
- Add Delivery stats (per courier) and Delivery pages with table + filters.
- Courier user dropdown lists staff by permission (DELIVERY) or owners.

---

## Backend Changes

### 0) Data integrity & indexes (required)

- Enforce unique tracking numbers and one-shipment-per-order:
  - Mongoose indexes:
    - `ShipmentSchema.index({ trackingNumber: 1 }, { unique: true })`
    - `ShipmentSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $exists: true } } })`
  - Guard in service to prevent creating a second shipment for the same order.
- Add performance indexes:
  - `ShipmentSchema.index({ courierUser: 1, status: 1, createdAt: -1 })`
  - `ShipmentSchema.index({ status: 1, createdAt: -1 })`
- Status state machine:
  - Define valid transitions (e.g., In-Warehouse → Shipped → Dispatched → Delivered; any → Returned/Failed)
  - Validate in service; return 409 on invalid transitions.

### 1) Permissions

- Add a new permission resource constant: `DELIVERY = 'delivery'` in `src/types/permissions.ts`.
- Courier users are users that either:
  - Have permission to the `delivery` resource, OR
  - Have role `owner`.

### 2) Auto-create Shipment on checkout

- File: `src/services/orderService.ts` → `secureCheckout`
- On successful checkout and when `deliveryType === 'shipping'` AND order is in an allowed status (e.g., `isPaid === true` or `status === 'Processing'`):
  - Create a Shipment with:
    - `orderId`: the created order `_id`
    - `trackingNumber`: auto-generated, e.g. `TRK${Date.now()}${randSuffix}`
    - `status`: default (model default 'In-Warehouse')
    - `estimatedDelivery`: `new Date(now + estimatedShipping.days)` if available
    - `shippingAddress`: snapshot from order
    - `cost`: computed shipping cost
    - `dimensions`: initially empty
  - Save Shipment and set `order.shipmentId = shipment._id`.
  - Ensure idempotency to avoid duplicates on retries.
  - If the order does not meet allowed statuses, skip creating a shipment.

### 3) Admin Shipment endpoints (existing group)

- Route base: `/admin/shipment`
- Extend update behavior to allow:
  - `courier?: string`
  - `courierUser?: ObjectId`
  - `dimensions?: { length?, width?, height?, weight? }`
  - `notes?: string`
- In `ShipmentService.updateShipment`:
  - If `courierUser` changes, add a code comment:
    // TODO: Consider sending notification or workflow trigger when courierUser changes

### 4) New Admin Delivery route group

- Route base: `/admin/delivery`
- Middlewares: `authenticateUser`, `isAdmin`, and strictly `requirePermission('delivery', 'read'|'update')` per endpoint.
  - Owners must always be allowed. If `requirePermission` doesn’t already treat owners as superusers, extend it to bypass checks for role `owner`.
- Endpoints (delivery-user–scoped with ownership checks):
  - GET `/mine` → list shipments where `courierUser == req.user._id` with pagination and optional status filter. Requires `requirePermission('delivery','read')`.
  - GET `/mine/stats` → stats for current courier (counts per status: In-Warehouse, Shipped, Dispatched, Delivered, Returned, Failed). Requires `requirePermission('delivery','read')`.
  - GET `/:shipmentId` → fetch one delivery (must be owned by courierUser). Requires `requirePermission('delivery','read')`.
  - PATCH `/:shipmentId/status` → update status (guard Delivered lock; set `deliveredOn` when transitioning to Delivered). Requires `requirePermission('delivery','update')`.
  - POST `/:shipmentId/tracking` → add tracking entry `{ status, location?, description }` and synchronize current status; respect Delivered lock. Requires `requirePermission('delivery','update')`.
  - PATCH `/:shipmentId/notes` → update notes; respect Delivered lock. Requires `requirePermission('delivery','update')`.

### 5) Shipments Stats API (global)

- Route base: `/admin/shipment/stats`
- Returns totals grouped by status and derived aggregates (e.g., total, delivered, in-progress, returned, failed).
- For use in admin Shipments page header.

### 6) Courier listing endpoint

- Route: `/admin/users/couriers`
- Returns minimal fields: `{ _id, name, email }`.
- Logic: include users with permission to `delivery` OR role `owner`.
- Validator: supports pagination and optional search by name/email.
- Permissions: protect with `requirePermission('delivery','read')` so only owners or users with DELIVERY read permission can fetch couriers.

### 7) Validators (new and updates)

- `src/validators/admin/DeliveryValidator.ts` (new):
  - `listMineValidator`: validates `page`, `limit`, optional `status`.
  - `shipmentIdValidator`: validates `:shipmentId` param.
  - `updateStatusValidator`: validates status enum.
  - `addTrackingValidator`: validates `{ status, location?, description }`.
  - `updateNotesValidator`: validates `{ notes: string }`.
- `src/validators/admin/ShipmentValidator.ts` (update):
  - `updateShipmentValidator` to accept `courier`, `courierUser`, `dimensions`, `notes`.
- `src/validators/admin/UsersValidator.ts` (new for couriers list):
  - Validates pagination and optional search.

### 8) Controllers

- `src/controller/admin/DeliveryController.ts` (new):
  - `listMine(req,res)` → ShipmentService.listByCourierUser
  - `statsMine(req,res)` → ShipmentService.statsByCourierUser
  - `getById(req,res)` → ShipmentService.getShipmentById with ownership guard
  - `updateStatus(req,res)` → ShipmentService.updateShipmentStatus (Delivered lock + deliveredOn auto-set)
  - `addTrackingUpdate(req,res)` → ShipmentService.addTrackingUpdate (Delivered lock)
  - `updateNotes(req,res)` → ShipmentService.updateNotes (Delivered lock)
- `src/controller/admin/ShipmentController.ts` (existing): no breaking changes; ensure PUT supports new fields.
- `src/controller/admin/UsersController.ts` (new) for couriers listing.

### 9) Services

- `src/services/admin/ShipmentService.ts`:
  - `createShipmentOnCheckout(order, { cost, days })`
  - `listByCourierUser(userId, page, limit, status?)`
  - `statsByCourierUser(userId)`
  - `statsAll()` for global shipments
  - Guards:
    - If `shipment.status === 'Delivered'`, block `updateStatus`, `addTrackingUpdate`, `updateNotes` with 409.
    - In `updateShipmentStatus`, when transitioning to Delivered and `deliveredOn` not set, set it.
    - Enforce status transition rules (state machine). Return 409 on invalid transitions.
  - Ownership checks for delivery-person endpoints.
- `src/services/admin/UsersService.ts` (new):
  - `listCouriers({ page, limit, search })` → filters by permission DELIVERY or role owner; return minimal fields.

#### Service return contract (BannerService pattern)

All new/updated services must follow the `BannerService` response shape for consistency:

- Success: return `CustomResponseType<T>` with `{ message, data, code }` and appropriate HTTP-like `code` (e.g., 200, 201).
- Paginated/list responses: use `CustomResponseTypeWithMeta<T, M>` and include a `meta` object `{ page, limit, total, pages }`.
- Not found: `{ message: 'X not found', data: null, code: 404 }`.
- Validation/conflict: use `400` (bad input) or `409` (conflict/invalid transition) with `data: null`.
- Server error: catch, log, and return `{ message: error.message || 'Failed to <action>', data: null, code: 500 }`.
- Type safety: return proper types; when returning Mongoose docs, prefer the inferred type (e.g., `IShipment`) and avoid `any`.

Example (update):

```ts
try {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) {
    return { message: 'Shipment not found', data: null, code: 404 };
  }
  // ... mutate and save
  return { message: 'Shipment updated successfully', data: shipment as unknown as IShipment, code: 200 };
} catch (error) {
  console.error('Error updating shipment:', error);
  return { message: 'Failed to update shipment', data: null, code: 500 };
}
```

### 10) Routes wiring

- `src/routes/admin/delivery.ts` (new):
  - Wire endpoints with validators and DeliveryController.
- `src/routes/admin/users.ts` (ensure or add) → add `GET /couriers`.
- `src/server.ts`:
  - `app.use('/admin/delivery', AdminDeliveryRoute);`
  - Ensure users and shipment stats routes are registered.

---

## Admin Frontend Changes (apps/isomorphic)

### 1) Shipments page: add stats header

- Add stats section to Shipments page, similar to Transactions stats.
- Create hook `useShipmentStats()` → calls `/admin/shipment/stats`.
- Render cards: total, delivered, in-progress (Shipped/Dispatched), returned, failed.

### 2) Shipment edit screen

- Add fields for courier, courierUser (dropdown), dimensions, notes.
- Courier user dropdown uses new endpoint `/admin/users/couriers` via `useCouriers()`.
- Submit via existing shipment update mutation.
- UI note: After choose courierUser, no extra logic now; backend has a comment placeholder for future notification.

### 3) Delivery pages (delivery user’s view)

- Follow the standardized pattern used for Shipments:
  - Server wrapper: `app/(hydrogen)/ecommerce/delivery/page.tsx`
  - Client: `shared/ecommerce/delivery/DeliveryClient.tsx` → stats header + table
  - Table pieces: `delivery-list/{table.tsx, columns.tsx, filters.tsx, table-skeleton.tsx, delivery-page-header.tsx}`
  - Detail and edit:
    - `app/(hydrogen)/ecommerce/delivery/[id]/page.tsx`
    - `app/(hydrogen)/ecommerce/delivery/[id]/edit/page.tsx`
- Features:
  - List my deliveries with status filter.
  - Edit allowed fields: notes, add tracking updates, status.
  - UI guard: When status === Delivered, disable edits for status/notes/tracking.

### 4) React Query hooks

- Queries:
  - `useShipmentStats()` → `/admin/shipment/stats`
  - `useCouriers()` → `/admin/users/couriers`
  - `useMyDeliveries(params)` → `/admin/delivery/mine`
  - `useMyDeliveryStats()` → `/admin/delivery/mine/stats`
  - `useDeliveryById(id)` → `/admin/delivery/:id`
- Mutations:
  - `useUpdateShipment()` → PUT `/admin/shipment/:id`
  - `useUpdateDeliveryStatus()` → PATCH `/admin/delivery/:id/status`
  - `useAddDeliveryTracking()` → POST `/admin/delivery/:id/tracking`
  - `useUpdateDeliveryNotes()` → PATCH `/admin/delivery/:id/notes`

#### React Query placeholders (required)

To prevent UI flicker and render churn, all newly created hooks must provide stable placeholder data and use `enabled` guards:

- Always set `placeholderData` (or `initialData` where appropriate) with stable references:
  - Lists: `placeholderData: []` (defined once outside the component as a constant like `EMPTY: readonly []`)
  - Objects: `placeholderData: { ...shape, items: [] }` with all required keys present
- Use `enabled: !!id` for id-based queries (e.g., `useDeliveryById(id)`)
- Prefer `select` to map/shape data without creating new array/object instances every render
- Avoid setting local state from query data in effects; render directly from query data when possible

Example:

```ts
const EMPTY_LIST: readonly any[] = [];

export function useMyDeliveries(params: { page: number; limit: number; status?: string }) {
  return useQuery({
    queryKey: ['deliveries', params],
    queryFn: () => apiClient.get(api.delivery.mine, { params }).then(r => r.data!),
    placeholderData: EMPTY_LIST,
    staleTime: 60_000,
  });
}

export function useDeliveryById(id?: string) {
  return useQuery({
    queryKey: ['delivery', id],
    queryFn: () => apiClient.get(api.delivery.byId(id!)).then(r => r.data!),
    enabled: !!id,
    placeholderData: { _id: '', status: 'In-Warehouse', trackingHistory: [], notes: '', estimatedDelivery: null, deliveredOn: null },
  });
}
```

### 5) UI guards and messages

- Disable mutations when `status === 'Delivered'`.
- Show `deliveredOn` when present.
- Surface backend 409 errors as toasts.

---

## Data Model

- No changes required to `Shipment` or `Order` models; fields already present:
  - `Shipment`: `courier`, `courierUser`, `status`, `estimatedDelivery`, `deliveredOn`, `dimensions`, `cost`, `notes`, `trackingHistory`.
  - `Order`: `shipmentId` reference.

Add the following indexes to `Shipment` for integrity and performance:

```
ShipmentSchema.index({ trackingNumber: 1 }, { unique: true });
ShipmentSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $exists: true } } });
ShipmentSchema.index({ courierUser: 1, status: 1, createdAt: -1 });
ShipmentSchema.index({ status: 1, createdAt: -1 });
```

---

## Edge Cases & Rules

- Delivered Lock: further changes to status, notes, and tracking are blocked (service + UI).
- deliveredOn auto-set only when transitioning to Delivered (do not overwrite if set).
- Ownership: delivery endpoints are restricted to `courierUser` of the shipment.
- Checkout: create shipment only if deliveryType === 'shipping'; for pickup, skip shipment creation.
- Admin-level overrides: Admin can update shipment meta but still respect the Delivered lock for consistency.
- Order lifecycle integration:
  - Only create shipment if the order is Paid (or in allowed statuses) on checkout success.
  - If the order is canceled or refunded later, reflect on shipment state by transitioning to `Returned` or an appropriate terminal state.

---

## Acceptance Criteria

- Shipment is auto-created and linked on checkout success for shipping orders.
- Admin can set courier, courierUser, dimensions, and notes.
- Courier listing returns only owners or users with DELIVERY permission, minimal fields.
- Shipments Stats API returns status breakdown; Shipments page shows stats header.
- Delivery user sees only their deliveries, with stats and a filterable table.
- Delivery user can update notes, tracking, and status until Delivered; blocked afterward.
- `deliveredOn` gets set automatically upon Delivered transition.

---

## Implementation Order

1) Backend: permission constant, shipment auto-create, shipment stats API, couriers list endpoint.
2) Backend: delivery routes + validators + controller + service with guards.
3) Frontend: hooks for stats, couriers, my deliveries; shipments stats UI; delivery pages.
4) UI guards for Delivered; connect mutations.
5) QA: Typecheck, run build, and test a few flows.

---

## Notes

- On `courierUser` change within admin shipment update, a code comment is added to consider notification/assignment workflow in the future.
- Reuse existing admin auth and permission middlewares.
