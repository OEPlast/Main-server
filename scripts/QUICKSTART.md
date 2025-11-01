# 🚀 Quick Start - Test Data Generation

## Run Test Data Seeder

```bash
cd old-main-server
npx ts-node scripts/seed-test-data.ts
```

## What Gets Created

| Item | Count | Details |
|------|-------|---------|
| 🎟️ **Coupons** | 12 | 10%-40% off or ₦500-₦5,000 flat |
| 📦 **Products** | 40 | ₦1,000-₦20,000, wholesale plastics |
| 👥 **Test Users** | 20 | testuser1-20@oeplast.com |
| 🛒 **Orders** | 100 | 65% completed, 12% processing, etc. |
| 💳 **Transactions** | 100 | 70% success, 15% pending, 15% failed |

## Test Coupon Codes

```
WELCOME10    - 10% off
SAVE20       - 20% off
BULK25       - 25% off
FLAT1000     - ₦1,000 off
MEGA30       - 30% off
CLEARANCE40  - 40% off
```

## Cleanup Test Data

```bash
npx ts-node scripts/cleanup-test-data.ts
```

## Test the Top Categories Endpoint

After seeding, test your endpoint:

```bash
# Should now return categories with sales data
curl http://localhost:4000/products/top-categories?limit=10
```

## Expected Result

The endpoint should return categories like:

```json
{
  "message": "Top categories retrieved successfully",
  "data": [
    {
      "_id": "...",
      "name": "Household Items",
      "slug": "household-items",
      "image": "..."
    },
    {
      "_id": "...",
      "name": "Kitchen & Dining",
      "slug": "kitchen-dining",
      "image": "..."
    }
  ],
  "code": 200
}
```

## Notes

- ✅ Products created with SKU >= 10001 (easy to identify test data)
- ✅ Orders backdated over 120 days for realistic analytics
- ✅ 30% of orders have coupons applied
- ✅ All Nigerian locations and names
- ✅ Realistic wholesale pricing tiers

---

**Full Documentation:** See `SEED_TEST_DATA_README.md`
