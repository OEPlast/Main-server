# Quick Start Guide - Analytics Test Data Scripts

## Prerequisites

1. **Build the project** (required - scripts use compiled models):
   ```bash
   cd /Users/chocos/Documents/CODE/oslold/oslbackend/old-main-server
   npm run build
   ```

2. **Ensure MongoDB is running** and `.env` is configured with `MONGO_URL`

3. **Install ts-node** (if not already installed):
   ```bash
   # Global install (recommended)
   npm install -g ts-node

   # Or use npx (no install needed)
   npx ts-node --version
   ```

## Usage

### Populate Test Data

```bash
# From project root
ts-node scripts/populate-analytics-test-data.ts

# Or with npx
npx ts-node scripts/populate-analytics-test-data.ts
```

**What it creates:**
- ~500 test users (`*@analytics-test.local`)
- 20 categories (`TEST_CAT_*`)
- ~200 products (`TEST_ANALYTICS_*`)
- ~50 coupons (`TEST*ANALYTICS`)
- ~2000 orders (excluding gap periods)
- ~2000 transactions
- ~1500 reviews
- ~800 wishlist entries

**Gap Periods (no data):**
- 2021-2022 (full years)
- June 1 - July 20, 2025 (mid-year)

**Time:** 2-5 minutes

### Clean Up Test Data

```bash
# From project root
ts-node scripts/delete-analytics-test-data.ts

# Or with npx
npx ts-node scripts/delete-analytics-test-data.ts
```

**Safety features:**
- 3-second delay (press Ctrl+C to cancel)
- Only deletes records with test identifiers
- Verification check after deletion
- Detailed summary

**Time:** 30-60 seconds

## TypeScript Notes

Both scripts use `// @ts-nocheck` at the top to ignore TypeScript errors, so they'll run without type-checking issues. The scripts are properly typed with ES modules import syntax and work seamlessly with ts-node.

## Troubleshooting

**Error: "Cannot find module '../dist/models/User.js'"**
- **Solution**: Run `npm run build` first

**Error: "ts-node: command not found"**
- **Solution**: Install ts-node globally or use npx

**Error: "Cannot connect to MongoDB"**
- **Solution**: Check `.env` file has correct `MONGO_URL`

For more details, see [README.md](./README.md)
