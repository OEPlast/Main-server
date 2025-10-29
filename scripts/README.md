# Analytics Test Data Scripts

This directory contains scripts for populating and cleaning up comprehensive test data for analytics testing.

## Scripts

### 1. `populate-analytics-test-data.ts`

Populates test data across 6 years (2019-2025) with intentional gaps for edge case testing.

#### Data Periods

- **2019-2020**: Full data coverage
- **2021-2022**: ❌ NO DATA (gap for testing)
- **2023 - May 31, 2025**: Full data coverage
- **June 1 - July 20, 2025**: ❌ NO DATA (gap for testing)
- **July 21 - October 27, 2025**: Full data coverage

#### Test Data Generated

| Collection | Approximate Count | Notes |
|-----------|------------------|-------|
| Users | ~500 | Email: `testuser*@analytics-test.local` |
| Categories | 20 | Name prefix: `TEST_CAT_` |
| Products | ~200 | Name prefix: `TEST_ANALYTICS_` |
| Coupons | ~50 | Code format: `TEST*ANALYTICS` |
| Orders | ~2000 | Linked to test users, excludes gap periods |
| Transactions | ~2000 | One per order, various payment methods |
| Reviews | ~1500 | Verified purchase reviews, ratings 1-5 |
| Wishlists | ~800 | Distributed across test users |

**Note**: Actual counts may be lower due to gap period filtering.

#### Features

- **Realistic Data Distribution**: Orders, transactions, and reviews distributed across valid time periods
- **Multiple Payment Methods**: `paystack`, `stripe`, `flutterwave`, `bank_transfer`, `cash_on_delivery`, `store_credit`
- **Order Status Variety**: `pending`, `processing`, `completed`, `cancelled`, `failed`
- **Geographic Diversity**: Users from Nigeria, Ghana, Kenya, South Africa, USA, UK, Canada
- **Coupon Usage**: ~30% of orders use test coupons
- **Rating Distribution**: Reviews range from 1-5 stars
- **Gap Period Handling**: Automatically skips data generation for 2021-2022 and June 1 - July 20, 2025

#### Usage

```bash
# From the project root
ts-node scripts/populate-analytics-test-data.ts

# Or with npx if ts-node is not globally installed
npx ts-node scripts/populate-analytics-test-data.ts
```

#### What It Does

1. Connects to MongoDB using `.env` configuration
2. Creates 500 test users with realistic profiles
3. Creates 20 test product categories
4. Creates 200 test products across categories
5. Creates 50 test coupons (percentage and fixed discounts)
6. Creates ~2000 orders with associated transactions
7. Creates ~1500 verified purchase reviews
8. Creates ~800 wishlist entries
9. Displays detailed summary of created data

#### Time Required

Approximately **2-5 minutes** depending on database performance.

---

### 2. `delete-analytics-test-data.ts`

Completely removes all test data created by the populate script.

#### What Gets Deleted

All records matching test identifiers:
- Users with email ending in `@analytics-test.local`
- Products with name starting with `TEST_ANALYTICS_`
- Categories with name starting with `TEST_CAT_`
- Coupons with code matching `TEST*ANALYTICS`
- All orders, transactions, reviews, and wishlists linked to test users
- Orphaned wishlists (where user no longer exists)

#### Safety Features

- **3-second delay** before deletion starts (press Ctrl+C to cancel)
- **Cascade deletion** in correct order to handle relationships
- **Verification check** after deletion to confirm cleanup
- **Detailed summary** of what was deleted

#### Usage

```bash
# From the project root
ts-node scripts/delete-analytics-test-data.ts

# Or with npx
npx ts-node scripts/delete-analytics-test-data.ts

# The script will display a warning and wait 3 seconds
# Press Ctrl+C to cancel if needed
```

#### Deletion Order

1. Test users (and their wishlists)
2. Test orders (and linked transactions/reviews)
3. Remaining transactions
4. Test categories
5. Test products (and their reviews)
6. Remaining reviews
7. Test coupons
8. Orphaned wishlists

#### Time Required

Approximately **30-60 seconds** depending on database performance.

---

## Prerequisites

### Required Environment Variables

Create a `.env` file in the project root with:

```env
MONGO_URL=mongodb://localhost:27017/your-database-name
```

### Required Dependencies

The scripts use the following dependencies (already in package.json):

- `mongoose` - Database connection
- `dotenv` - Environment variable loading
- `ts-node` - TypeScript execution (install globally or use npx)
- `typescript` - TypeScript compiler

### Install ts-node (if not already installed)

```bash
# Global installation
npm install -g ts-node

# Or use npx (no installation needed)
npx ts-node --version
```

### Build Project First

Since the scripts import compiled TypeScript models, build the project first:

```bash
npm run build
```

---

## Complete Workflow

### Initial Setup

```bash
# 1. Ensure MongoDB is running
# 2. Configure .env file
# 3. Build the project
npm run build

# 4. Populate test data
ts-node scripts/populate-analytics-test-data.ts
```

### Testing Analytics

Use the populated data to test all analytics endpoints across different time periods, including edge cases with missing data.

### Cleanup After Testing

```bash
# Remove all test data
ts-node scripts/delete-analytics-test-data.ts
```

---

## Test Data Identifiers

To avoid accidentally deleting real data, all test records use unique identifiers:

| Field | Pattern | Example |
|-------|---------|---------|
| User Email | `*@analytics-test.local` | `testuser0@analytics-test.local` |
| Product Name | `TEST_ANALYTICS_*` | `TEST_ANALYTICS_Product_42` |
| Category Name | `TEST_CAT_*` | `TEST_CAT_Electronics` |
| Coupon Code | `TEST*ANALYTICS` | `TEST15ANALYTICS` |
| Transaction Reference | `TEST_TXN_*` | `TEST_TXN_123_1698432000000` |

**Important**: Only records matching these patterns will be deleted by the cleanup script.

---

## Troubleshooting

### "Cannot find module" Error

**Problem**: Scripts can't find compiled model files.

**Solution**:
```bash
npm run build
```

### "Connection Error"

**Problem**: Can't connect to MongoDB.

**Solutions**:
- Ensure MongoDB is running
- Check `MONGO_URL` in `.env`
- Verify network connectivity

### "Insufficient Data Created"

**Problem**: Less data than expected was created.

**Reason**: Gap period filtering excludes 2021-2022 and June 1 - July 20, 2025.

**Solution**: This is intentional for testing edge cases. If you need more data in valid periods, increase the count parameters in `populate-analytics-test-data.ts`.

### "Deletion Incomplete"

**Problem**: Verification shows remaining test data.

**Solutions**:
1. Run the delete script again
2. Check database directly for orphaned records
3. Manually delete using MongoDB queries if needed:

```javascript
// In MongoDB shell
db.users.deleteMany({ email: /@analytics-test\.local$/ });
db.products.deleteMany({ name: /^TEST_ANALYTICS_/ });
db.categories.deleteMany({ name: /^TEST_CAT_/ });
db.coupons.deleteMany({ code: /^TEST.*ANALYTICS$/ });
```

---

## Analytics Testing Guide

### Test Coverage

The generated data allows you to test:

1. **Time-series trends** across 6 years
2. **Gap handling** (2021-2022 and June 1 - July 20, 2025)
3. **Year-over-year comparisons** (2019 vs 2020, 2023 vs 2024)
4. **Seasonal patterns** within each valid year
5. **Payment method distribution** across all methods
6. **Order status workflows** from pending to completed/cancelled
7. **Review sentiment analysis** with ratings 1-5
8. **Coupon effectiveness** with usage tracking
9. **Product performance** across categories
10. **User acquisition** trends over time

### Sample API Tests

```bash
# Test full period (should include gaps)
GET /admin/analytics/revenue-by-days?from=2019-01-01&to=2025-10-27

# Test gap period (should return empty/zero)
GET /admin/analytics/orders-by-months?from=2021-01-01&to=2022-12-31

# Test valid period
GET /admin/analytics/transactions-trend?from=2023-01-01&to=2023-12-31&groupBy=months

# Test mid-year gap
GET /admin/analytics/reviews-by-days?from=2025-06-01&to=2025-07-20
```

---

## Notes

- **Non-destructive**: Populate script only creates new data, doesn't modify existing records
- **Idempotent**: Can run populate script multiple times (creates additional test data each time)
- **Safe Deletion**: Delete script only removes records matching test identifiers
- **Production Warning**: ⚠️ Do NOT run these scripts in production environments!

---

## Support

For issues or questions:
1. Check this README
2. Review script console output for detailed error messages
3. Check MongoDB logs
4. Verify `.env` configuration
