# GIG Logistics Integration Guide

GIG (GIGL) is the third-party door-to-door shipping provider integrated into this platform. This document covers setup, configuration, environment variables, and production readiness steps.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [First-Time Setup Order](#first-time-setup-order)
3. [Finding Your Sender Station ID](#finding-your-sender-station-id)
4. [Running Database Migrations](#running-database-migrations)
5. [Admin Panel Configuration](#admin-panel-configuration)
6. [How GIG Shipping Works](#how-gig-shipping-works)
7. [Files Changed per Project](#files-changed-per-project)
8. [Production Checklist](#production-checklist)

---

## Environment Variables

### Backend (`old-main-server/.env`)

| Variable           | Required | Description                                                                                                                      |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GIG_API_URL`      | Yes      | GIG API base URL. Dev: `https://dev-thirdpartynode.theagilitysystems.com` / Prod: `https://thirdpartynode.theagilitysystems.com` |
| `GIG_ACCESS_TOKEN` | Yes      | JWT bearer token from your GIG third-party account. Get this from the GIG developer portal.                                      |

> **Note**: All sender/warehouse details (name, address, station ID, coordinates, etc.) are stored in the database via the admin panel — not in `.env`. See [Admin Panel Configuration](#admin-panel-configuration).

### Storefront (`storefront/.env`)

| Variable                          | Required | Description                                                                                                                                    |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes      | Google Maps API key. Required for address autocomplete in checkout. Enable **Places API** and **Maps JavaScript API** in Google Cloud Console. |

### Web Admin (`web-admin/apps/isomorphic/.env`)

No new environment variables required for GIG shipping.

---

## First-Time Setup Order

Follow these steps exactly to get GIG shipping working from scratch:

**Step 1 — Set environment variables**

In `old-main-server/.env`, ensure these are set:

```
GIG_API_URL=https://dev-thirdpartynode.theagilitysystems.com
GIG_ACCESS_TOKEN=<your_token_from_gig_portal>
```

In `storefront/.env`:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your_google_maps_api_key>
```

**Step 2 — Run the dimensions migration** (one-time, for existing products)

```bash
cd old-main-server
npx ts-node -r tsconfig-paths/register scripts/migrations/add-shipping-dimensions-to-products.ts
```

This backfills `weight`, `height`, `width`, `length`, and `isVolumetric` on all products that existed before the GIG integration. New products created through the admin panel will always have these fields.

**Step 3 — Find your Sender Station ID**

Your warehouse must be associated with a GIG station. Run the lookup script to print the full station list:

```bash
npx ts-node -r tsconfig-paths/register scripts/list-gig-stations.ts
```

Filter by city or state:

```bash
npx ts-node -r tsconfig-paths/register scripts/list-gig-stations.ts --filter lagos
npx ts-node -r tsconfig-paths/register scripts/list-gig-stations.ts --filter abuja
```

Find the row matching your warehouse location and note the `StationId` number. You will enter this in the next step.

**Step 4 — Configure GIG in the admin panel**

1. Open Admin → **GIG Settings** (in the logistics/shipping section)
2. Fill in all fields:
   - **Sender Name** — your store/warehouse name
   - **Sender Phone** — warehouse contact phone number
   - **Sender Address** — exact warehouse street address
   - **Sender Locality** — neighbourhood or local area (can be empty)
   - **Sender Station ID** — the number you found in Step 3
   - **Sender Latitude / Longitude** — coordinates of your warehouse (use Google Maps to find these — right-click the location → "What's here?")
   - **Sender Country Code** — `NG`
   - **Customer Code** — your GIG account's customer code (from GIG portal, e.g. `ECO038082`)
   - **Customer Type** — leave blank unless GIG support specifies otherwise
   - **Vehicle Type** — `BIKE` for small/light parcels, `VAN` for medium, `TRUCK` for bulk
   - **Default Pick-Up Options** — usually leave blank
   - **Is Active** — leave `false` until you've verified a test shipment
3. Save the configuration

**Step 5 — Test a shipment**

1. Place a test order using a real address in a state GIG serves
2. In Admin → Orders → select the order → Ship with GIG
3. Verify the waybill number is returned and the order status updates to "Shipped"
4. Confirm the tracking number appears in the customer's order history page

**Step 6 — Activate**

After a successful test shipment, go back to Admin → GIG Settings and set **Is Active** to `true`. GIG shipping will now appear as an option to customers at checkout.

---

## Finding Your Sender Station ID

The Sender Station ID is a numeric ID assigned by GIG to the station closest to your warehouse. It is used in every price calculation and shipment creation request.

**How to look it up:**

```bash
# From the old-main-server directory:
npx ts-node -r tsconfig-paths/register scripts/list-gig-stations.ts

# Sample output:
# ----------+----------------------------------------+-------------------------+--------
# StationId |StationName                             |StateName                |Active
# ----------+----------------------------------------+-------------------------+--------
# 4         |Ikeja Station                           |Lagos                    |Yes
# 57        |Abuja Hub                               |FCT                      |Yes
# ...
```

Filter to narrow down:

```bash
npx ts-node -r tsconfig-paths/register scripts/list-gig-stations.ts --filter lagos
```

Once you find the right row, use the `StationId` value (the leftmost number) as your **Sender Station ID** in the admin panel.

> **Important**: Use the station closest to your physical warehouse, not your city's headquarters. If you're in Ikeja, Lagos, use the Ikeja station ID, not a generic Lagos one.

---

## Running Database Migrations

### Shipping Dimensions (required for GIG)

Adds `weight`, `height`, `width`, `length`, `isVolumetric` to all existing products.

```bash
cd old-main-server

# Run
npx ts-node -r tsconfig-paths/register scripts/migrations/add-shipping-dimensions-to-products.ts

# Roll back (removes the fields)
npx ts-node -r tsconfig-paths/register scripts/migrations/add-shipping-dimensions-to-products.ts --rollback
```

Default values applied: `weight=1kg`, all dimensions `10cm`, `isVolumetric=false`.

After running, go through your product catalogue in Admin → Products and update each product's actual dimensions and weight. Accurate values are critical — they directly affect the shipping price shown to customers.

> See `scripts/migrations/README.md` for all available migrations.

---

## Admin Panel Configuration

The GIG configuration is stored as a single document in the `gigconfigs` MongoDB collection. It is managed entirely through the admin panel UI.

**Fields stored in the database:**

| Field                      | Type     | Notes                                                                                  |
| -------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `senderName`               | String   | Warehouse / store name shown on GIG shipments                                          |
| `senderPhoneNumber`        | String   | Nigerian format, e.g. `08012345678`                                                    |
| `senderAddress`            | String   | Full street address                                                                    |
| `senderLocality`           | String   | Neighbourhood / locality (optional)                                                    |
| `senderStationId`          | Number   | GIG station ID — see [Finding Your Sender Station ID](#finding-your-sender-station-id) |
| `senderLatitude`           | Number   | GPS latitude of warehouse                                                              |
| `senderLongitude`          | Number   | GPS longitude of warehouse                                                             |
| `senderCountryCode`        | String   | Always `NG`                                                                            |
| `customerCode`             | String   | GIG account customer code                                                              |
| `customerType`             | String   | GIG customer type (usually blank)                                                      |
| `vehicleType`              | String   | `BIKE`, `VAN`, or `TRUCK`                                                              |
| `defaultDeliveryOptionIds` | Number[] | GIG delivery option IDs (optional)                                                     |
| `defaultPickUpOptions`     | String   | GIG pickup mode (optional)                                                             |
| `isActive`                 | Boolean  | Master switch — enables/disables GIG at checkout                                       |

---

## How GIG Shipping Works

**At checkout (storefront):**

1. Customer enters their delivery address using Google Places Autocomplete
2. Coordinates (lat/lng) are captured with the address
3. After cart review, if the customer selects "GIG Delivery", the storefront calls the backend price endpoint
4. Backend loads the `GIGConfig` from DB, resolves the receiver station by state name, calls the GIG price API, and returns the cost
5. The cost is shown to the customer before payment

**After payment:**

1. The order is created with `deliveryType: 'gig'`
2. Admin reviews the order in Admin → Orders
3. Admin clicks "Ship with GIG" to create a preshipment — GIG returns a waybill number
4. The waybill is saved to the order (`gigWaybill` field)
5. An `ORDER_SHIPPED` event is published to the event bus
6. Event bus sends a shipping confirmation email and Telegram notification containing the GIG waybill number
7. The customer can view the waybill on their order tracking page

---

## Files Changed per Project

### Backend (`old-main-server/src`)

**Models:**

- `models/GIGConfig.ts` — GIG configuration singleton model
- `models/Product.ts` — added `weight`, `height`, `width`, `length`, `isVolumetric` fields
- `models/Order.ts` — added `deliveryType: 'gig'` variant and `gigWaybill` field

**Services:**

- `services/GIGService.ts` — GIG API client (price, preshipment, tracking, stations, config management)
- `services/orderService.ts` — fixed aggregation to include `shippingAddress` and `gigWaybill` for GIG orders
- `services/TransactionService.ts` — passes `gigWaybill` in `ORDER_SUCCESSFUL` event
- `services/admin/ShipmentService.ts` — passes `gigWaybill` in `SHIPMENT_STATUS_UPDATED` event
- `services/admin/Order.ts` — updated `EnrichedOrder` type to include `deliveryType: 'gig'` and `gigWaybill`

**Types:**

- `types/gig.ts` — all GIG API request/response type definitions

**Routes / Controllers:**

- Admin routes for GIG config (get/update) and station listing

**Scripts:**

- `scripts/list-gig-stations.ts` (new) — lookup helper for finding Sender Station ID
- `scripts/migrations/add-shipping-dimensions-to-products.ts` — backfills product dimensions

### Storefront (`storefront/src`)

- `components/Checkout/AddressForm.tsx` — Google Places Autocomplete for address input, captures lat/lng
- `components/Checkout/OrderSummaryBlock.tsx` — displays GIG as a valid shipping method
- `components/Order/OrderTrackingHistory.tsx` — shows GIG waybill number on order tracking page
- `types/order.ts` — `DeliveryType` includes `'gig'`, `EnrichedOrder` has `gigWaybill` field

### Event Bus (`event-bus/src`)

- `handlers/OrderEventHandler.ts` — handles `ORDER_SUCCESSFUL` / `SHIPMENT_STATUS_UPDATED` with 3-way delivery type mapping (`shipping` / `gig` / `pickup`), passes `gigWaybill` to email and Telegram handlers
- `handlers/TelegramNotificationHandler.ts` — GIG-specific notification message with waybill number
- `mails/order-confirmation.html` — added GIG waybill row (conditionally shown)
- `mails/order-shipped.html` — fixed hardcoded tracking number, added GIG waybill row
- `types/email-data.ts` — added `gigWaybill?: string` to confirmation and shipped email data interfaces

---

## Production Checklist

Before going live with GIG shipping in production:

- [ ] **Swap API URL**: Change `GIG_API_URL` in `.env` from `https://dev-thirdpartynode.theagilitysystems.com` to `https://thirdpartynode.theagilitysystems.com`
- [ ] **Rotate access token**: GIG JWT tokens have an expiry. Check the `exp` claim in your `GIG_ACCESS_TOKEN` and obtain a fresh production token from the GIG portal before launch
- [ ] **Run dimensions migration on production DB**: `npx ts-node -r tsconfig-paths/register scripts/migrations/add-shipping-dimensions-to-products.ts`
- [ ] **Update product dimensions**: After migration, review all active products and set accurate weight/dimension values in Admin → Products
- [ ] **Configure GIG Settings in admin**: Re-enter all sender fields in the production admin panel (the config is in the database, not transferred automatically between environments)
- [ ] **Verify Sender Station ID**: Re-run `list-gig-stations.ts` against the production API URL to confirm the station ID is the same
- [ ] **Test one shipment end-to-end**: Place a real paid order, ship with GIG, confirm waybill is returned, confirm email and Telegram notification are received
- [ ] **Activate**: Set `isActive: true` in Admin → GIG Settings only after the test is confirmed successful
- [ ] **Google Maps key restriction**: In Google Cloud Console, restrict the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to your production domain to prevent quota abuse
