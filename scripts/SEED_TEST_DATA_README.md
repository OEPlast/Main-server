# Test Data Seeding Script

This script generates comprehensive test data for the OEPlast wholesale plastics store database.

## What It Creates

### 📦 Products (40 items)
- Price range: ₦1,000 - ₦20,000 per unit
- Distributed across existing categories
- Realistic wholesale plastic products
- Includes SKU, descriptions, images, pricing tiers
- 90% active, 10% inactive
- Random stock levels and sold counts

### 🎟️ Coupons (12 items)
- Mix of percentage and fixed discounts
- Various discount amounts (10%-40%, ₦500-₦5,000)
- Minimum purchase requirements
- Valid for 90 days from creation
- Usage limits configured

### 👥 Test Users (20 items)
- Nigerian names and email addresses
- Phone numbers in Nigerian format
- User role assigned

### 🛒 Orders (100 items)
Status distribution:
- **65%** Completed & Delivered
- **12%** Processing
- **10%** Shipped
- **8%** Pending
- **5%** Cancelled

### 💳 Transactions (100 items)
Status distribution:
- **70%** Successful
- **15%** Pending
- **15%** Failed

Payment methods: Paystack, Flutterwave, Bank Transfer

### Additional Features
- **30% of orders** have coupons applied
- **1-5 products** per order
- **1-10 quantity** per product in order
- Orders dated within last 120 days
- Realistic Nigerian shipping addresses
- Bulk pricing tiers for wholesale

## Prerequisites

1. **MongoDB running** with connection string in `.env`
2. **Categories must exist** in the database (run category seeder first if needed)
3. **All dependencies installed**: `npm install`

## Usage

### Run the script

```bash
# From old-main-server directory
npx ts-node scripts/seed-test-data.ts
```

### Expected Output

```
🌱 Starting OEPlast Test Data Seed...
============================================================
✅ Connected to MongoDB
============================================================

📂 STEP 1: Fetching existing categories...
✅ Found 6 categories:
   1. Household Items (household-items)
   2. Kitchen & Dining (kitchen-dining)
   ...

👤 STEP 2: Creating test users...
✅ Created/found 20 test users

🎟️  STEP 3: Creating 12 coupons...
✅ Created 12 coupons:
   - WELCOME10: 10% off (min: ₦7,500)
   - SAVE20: 20% off (min: ₦8,200)
   ...

📦 STEP 4: Creating 40 products...
✅ Created 40 products across 6 categories

🛒 STEP 5: Creating 100 orders with transactions...
✅ Created 100 transactions
✅ Created 100 orders

============================================================
📊 SEEDING STATISTICS
============================================================

📦 Orders by Status:
   Completed: 67 orders
   Processing: 11 orders
   Shipped: 10 orders
   Pending: 8 orders
   Cancelled: 4 orders

💳 Transactions by Status:
   success: 72 transactions (₦2,847,356)
   pending: 14 transactions (₦523,890)
   failed: 14 transactions (₦487,234)

🎟️  Coupons Applied: 29 orders (29.0%)

💰 Total Revenue: ₦2,847,356

============================================================
✅ TEST DATA SEEDING COMPLETED SUCCESSFULLY!
============================================================

🎉 Summary:
   - 12 coupons created
   - 40 products created
   - 100 orders created
   - 100 transactions created
   - 20 test users
```

## Testing the Data

After running the script, you can:

### 1. Test Top Categories Query

The `getTopCategories` function should now return results since we have completed orders with products linked to categories.

```bash
# Test the endpoint
curl http://localhost:4000/products/top-categories?limit=10
```

### 2. Browse Products by Category

```bash
curl http://localhost:4000/products/category/household-items
```

### 3. Check Orders

```bash
# View recent orders
curl http://localhost:4000/admin/orders?limit=20
```

### 4. Verify Transactions

```bash
# Check transaction stats
curl http://localhost:4000/admin/transactions/stats
```

## Data Cleanup

To remove all test data and start fresh:

```bash
npx ts-node scripts/cleanup-test-data.ts
```

This will delete:
- All products with SKU >= 10000
- All test users (testuser*@oeplast.com)
- All test coupons (WELCOME10, SAVE20, etc.)
- All associated orders and transactions

## Product Categories

The script creates products in these categories:

1. **Household Items** - Buckets, basins, waste bins, hangers
2. **Kitchen & Dining** - Food containers, plates, water bottles
3. **Storage & Organization** - Storage boxes, racks, organizers
4. **Child Care** - Baby bath tubs, potty chairs, toy storage
5. **Schools & Education** - Lunch boxes, water bottles, desk organizers
6. **Bathroom Essentials** - Soap dishes, toothbrush holders, caddies

## Coupon Codes for Testing

Use these codes when testing checkout:

- `WELCOME10` - 10% off
- `SAVE20` - 20% off
- `BULK25` - 25% off for bulk orders
- `FLAT500` - ₦500 flat discount
- `FLAT1000` - ₦1,000 flat discount
- `FLAT2000` - ₦2,000 flat discount
- `FIRST15` - 15% off first order
- `MEGA30` - 30% mega sale
- `VIP35` - 35% VIP discount
- `SPECIAL5K` - ₦5,000 special discount
- `NEWYEAR20` - 20% New Year sale
- `CLEARANCE40` - 40% clearance

## Troubleshooting

### "No categories found"

Run the category seeder first or create categories manually in the database.

### MongoDB connection error

Check your `.env` file has the correct `MONGODB_URI`.

### Duplicate key errors

The script handles duplicates by deleting existing test data first. If you still get errors, check for data conflicts with SKUs >= 10000.

## Notes

- All prices are in Nigerian Naira (₦)
- Products use SKUs starting from 10001
- Test user emails follow pattern: `testuser1@oeplast.com` to `testuser20@oeplast.com`
- Orders are backdated randomly within 120 days for realistic analytics
- Completed orders have delivery dates 1-7 days after order date
- Shipping prices range from ₦1,000 to ₦5,000

## Related Scripts

- `seed-categories.ts` - Create product categories (run first)
- `seed-test-data.ts` - This script (run second)
- `cleanup-test-data.ts` - Remove all test data (optional)

---

**Created:** October 2025  
**Version:** 1.0  
**Purpose:** Comprehensive test data generation for OEPlast e-commerce platform
