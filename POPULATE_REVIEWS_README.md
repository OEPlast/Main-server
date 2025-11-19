# Review Population Script

This script automatically generates sample reviews for products for testing purposes.

## Overview

The script will:

1. Fetch **all active users** from the database
2. Fetch the **200 most recent orders** (regardless of status) to identify products
3. For each product, **randomly assign 1-5 reviews** from different users
4. Distribute reviews across **ALL users** (not just users who made orders)
5. Create reviews with realistic ratings and text:
   - **5-star reviews**: 50% probability
   - **4-star reviews**: 30% probability
   - **3-star reviews**: 20% probability

## Key Features

- ✅ **Uses all users**: Distributes reviews across entire user base for realistic test data
- ✅ **Random distribution**: Each product gets 1-5 reviews from random users
- ✅ **Idempotent**: Skips products that already have reviews from the same user
- ✅ **Smart date handling**: Reviews dated within last 90 days
- ✅ **Detailed logging**: Shows progress and summary statistics
- ✅ **Error handling**: Continues processing even if individual reviews fail

## Cleanup Script

Before running the population script, use the cleanup script to delete all existing reviews:

```bash
ts-node cleanup-reviews.ts
```

This will:

- Count existing reviews
- Wait 3 seconds for confirmation (Ctrl+C to cancel)
- Delete all reviews from the database

## Prerequisites

1. MongoDB connection configured in `.env`
2. Node.js installed
3. Required models: `Order`, `Review`, `User`, `Product`

## Usage

### 1. Cleanup existing reviews (optional):

```bash
ts-node cleanup-reviews.ts
```

### 2. Run the population script:

```bash
ts-node populate-reviews.ts
```

Or add to package.json scripts:

```json
"cleanup:reviews": "ts-node cleanup-reviews.ts",
"populate:reviews": "ts-node populate-reviews.ts"
```

Then run:

```bash
npm run cleanup:reviews
npm run populate:reviews
```

### Expected Output:

```
✅ MongoDB connected successfully
🚀 Starting review population...

� Fetching all users...
✅ Found 150 active users

�📦 Fetching the 200 most recent orders...
✅ Found 200 orders

📊 Found 75 unique products from orders

🎲 Creating reviews with random user distribution...

✅ Created 5⭐ review for "Product Name" by John Doe
✅ Created 4⭐ review for "Product Name" by Jane Smith
✅ Created 3⭐ review for "Another Product" by Mike Johnson
⏭️  Review already exists for product "Existing Product" by Alice Brown
...

============================================================
📊 POPULATION SUMMARY
============================================================
Total users available: 150
Total products processed: 75
Reviews created: 280
Reviews skipped: 15
Errors: 0
============================================================

✅ Script completed successfully!
```

## How It Works

1. **Fetches all users**: Gets all non-suspended users from the database
2. **Identifies products**: Scans 200 recent orders to find products that have been ordered
3. **Random distribution**: For each product:
   - Randomly decides how many reviews (1-5)
   - Randomly selects that many users
   - Creates reviews from those users
4. **Realistic data**: Each review gets:
   - Random rating (weighted towards positive)
   - Appropriate review text template
   - Links to order/transaction if available
   - Random date within last 90 days

## Data Structure

### 5-Star Reviews (50% probability)

- "Excellent product!" - Highly positive feedback
- "Amazing quality" - Emphasizes product quality
- "Perfect!" - Enthusiastic endorsement
- "Highly recommended" - Strong recommendation
- "Outstanding" - Top-tier satisfaction

### 4-Star Reviews (30% probability)

- "Very good product" - Positive with minor reservations
- "Good quality" - Satisfied but room for improvement
- "Worth the money" - Good value proposition
- "Satisfied" - Meets expectations
- "Pretty good" - Positive overall assessment

### 3-Star Reviews (20% probability)

- "Average product" - Neutral/mixed feelings
- "Decent but not great" - Below expectations
- "It's okay" - Lukewarm satisfaction
- "Fair quality" - Acceptable but not impressive
- "Mixed feelings" - Both pros and cons

## Data Structure

Each generated review includes:

```javascript
{
  product: ObjectId,           // Product ID from orders
  reviewBy: ObjectId,          // Random user from database
  rating: Number,              // 5, 4, or 3
  title: String,               // Review title from template
  review: String,              // Review text from template
  transactionId: ObjectId,     // Transaction or order ID (if available)
  orderId: ObjectId,           // Order ID (if available)
  images: [],                  // Empty for auto-generated reviews
  likes: [],                   // Empty initially
  replies: [],                 // Empty initially
  isApproved: true,            // Auto-approved
  createdAt: Date,             // Random date within last 90 days
}
```

## Review Templates

## Safety Features

1. **Duplicate Prevention**: Checks for existing reviews before creating new ones
2. **Validation**: Skips orders without users or products
3. **Error Isolation**: Continues processing even if individual reviews fail
4. **Detailed Logging**: Tracks successes, skips, and errors

## Customization

### Change number of orders to scan:

```javascript
const orders = await Order.find()
  .sort({ createdAt: -1 })
  .limit(500)  // Change from 200 to 500
  .populate('products.product', '_id name slug')
  .lean() as unknown as PopulatedOrder[];
```

### Adjust review count per product:

```javascript
// Randomly decide how many reviews this product should get (1-5 reviews per product)
const reviewCount = Math.floor(Math.random() * 5) + 1;

// Change to fixed 3 reviews per product:
const reviewCount = 3;

// Or increase range to 3-8 reviews:
const reviewCount = Math.floor(Math.random() * 6) + 3;
```

### Adjust rating distribution:

```javascript
const getRandomRating = () => {
  const random = Math.random();
  if (random < 0.7) return 5; // 70% chance of 5 stars
  if (random < 0.9) return 4; // 20% chance of 4 stars
  return 3; // 10% chance of 3 stars
};
```

### Add more review templates:

```javascript
const reviewTemplates = {
  5: [
    // Add more 5-star templates here
    {
      title: 'Your custom title',
      review: 'Your custom review text...',
    },
  ],
  // ...
};
```

## Troubleshooting

### MongoDB Connection Error

```
❌ MongoDB connection error: ...
```

**Solution**: Check your `.env` file for correct `MONGODB_URL`

### No Orders Found

```
✅ Found 0 orders
```

**Solution**: Ensure your database has order data

### All Reviews Skipped

```
Reviews created: 0
Reviews skipped: 450
```

**Solution**: Reviews already exist. Delete existing reviews if you want to regenerate:

```javascript
await Review.deleteMany({});
```

## Notes

- **Run once**: This script is designed for initial data seeding
- **Production**: Use with caution on production databases
- **Backup**: Always backup your database before running population scripts
- **Re-run safe**: Script won't create duplicate reviews for the same user/product combination

## Integration with Review System

The generated reviews will:

- ✅ Appear in product review lists
- ✅ Affect product ratings
- ✅ Be counted in review statistics
- ✅ Be distributed across ALL users (not just order makers)
- ✅ Support likes and replies (empty initially)
- ⚠️ May or may not be linked to actual purchases (depends on if order data exists)

## Notes

- **Test data**: This script is designed for populating test/demo data
- **All users**: Reviews are distributed across your entire user base, not just order makers
- **Random assignment**: Users will review products they may not have actually purchased
- **Production**: Use with caution on production databases
- **Backup**: Always backup your database before running population scripts
- **Re-run safe**: Script won't create duplicate reviews for the same user/product combination
- **Cleanup**: Use `cleanup-reviews.ts` to remove all reviews before re-running
