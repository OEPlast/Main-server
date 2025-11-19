# Review Population Scripts - Quick Start

## 🎯 Purpose

Two scripts for managing test review data with targeted cleanup:

1. **populate-reviews.ts** - Create realistic test reviews & save their IDs
2. **cleanup-reviews.ts** - Delete only the generated reviews (using saved IDs)

## 🚀 Quick Usage

### Step 1: Populate

```bash
cd /Users/chocos/Documents/CODE/oslold/oslbackend/old-main-server
ts-node populate-reviews.ts
```

- Creates test reviews from all users
- Saves review IDs to `generated-review-ids.json`
- Each product gets 1-5 random reviews

### Step 2: Cleanup (When needed)

```bash
ts-node cleanup-reviews.ts
```

- Reads `generated-review-ids.json`
- Deletes ONLY the reviews created by populate script
- Removes the IDs file after cleanup
- If no IDs file found, offers to delete ALL reviews

## ✨ Key Features

### Populate Script

- **Smart distribution**: Uses all users, not just 2-3 order makers
- **Random assignment**: 1-5 reviews per product from random users
- **Realistic ratings**: 50% 5-star, 30% 4-star, 20% 3-star
- **ID tracking**: Saves all created review IDs to JSON file
- **Idempotent**: Won't create duplicates
- **Date variance**: Reviews dated within last 90 days

### Cleanup Script

- **Targeted deletion**: Only removes reviews from populate script
- **Safe**: Preserves manually created reviews (if any)
- **ID file-based**: Uses `generated-review-ids.json` for precision
- **Fallback option**: Can delete all reviews if no ID file exists
- **3-second confirmation**: Cancel with Ctrl+C

## 📊 Expected Results

### Before (Old approach):

- Only 2-3 users with orders
- Limited review variety
- Unrealistic distribution

### After (New approach):

- All 150+ users participate
- Each product: 1-5 reviews
- Natural distribution across user base
- ~280+ reviews from 75 products

## 🔧 Workflow

```bash
# 1. Generate test data
ts-node populate-reviews.ts
# Creates reviews + saves IDs to generated-review-ids.json

# 2. Test your application
# - Visit product pages
# - See diverse reviews from many users
# - Test review features

# 3. Clean up when done
ts-node cleanup-reviews.ts
# Deletes only the generated reviews using saved IDs

# 4. Re-populate if needed
ts-node populate-reviews.ts
# Safe to run again - creates new reviews
```

## 📁 Files Created

- **generated-review-ids.json** - Stores IDs of created reviews
  - Created by: `populate-reviews.ts`
  - Used by: `cleanup-reviews.ts`
  - Auto-deleted after cleanup
  - Added to `.gitignore`

## 📝 Notes

- **Targeted cleanup**: Only deletes reviews from populate script
- **Safe for manual reviews**: Won't touch reviews created through UI/API
- **Test data only**: For development/demo purposes
- **Backup first**: Always backup production databases
- **ID tracking**: Review IDs stored in JSON for precise cleanup
- **All users**: Reviews from entire user base, not just purchasers

## 🎨 Customization

See `POPULATE_REVIEWS_README.md` for:

- Changing review count per product
- Adjusting rating distribution
- Modifying date ranges
- Adding more review templates
