# Product Data Simulation Script

## Overview

This script generates realistic test data for product analytics endpoints. It creates:

1. **50+ New Products** - Recently created products (within last 30 days)
2. **50+ Week Products** - Products with orders from the last 7 days
3. **50+ Top Sold Products** - Products with many completed orders (last 6 months)

## Usage

```bash
cd old-main-server
ts-node scripts/simulate-product-data.ts
```

## What It Creates

### 1. New Products (50+)
- **Creation Date**: Randomly distributed within last 30 days
- **Status**: Active
- **Stock**: 10-210 units
- **Price**: $50-$550
- **Rating**: 3-5 stars
- **Categories**: Random from existing categories
- **Brands**: TechBrand, QualityPro, MasterCraft, EliteGoods

**Endpoint**: `GET /products/new-products?page=1&limit=20`

### 2. Week Products (50+)
- **Products**: Uses existing products or creates new ones
- **Orders**: 5-20 orders per product
- **Order Date**: Randomly within last 7 days
- **Quantity**: 1-5 units per order
- **Status**: All orders marked as "Completed"

**Endpoint**: `GET /products/top-week?page=1&limit=20`

### 3. Top Sold Products (50+)
- **Products**: Uses existing products or creates new ones
- **Orders**: 20-100 orders per product
- **Order Date**: Randomly within last 180 days (6 months)
- **Quantity**: 1-5 units per order
- **Status**: All orders marked as "Completed"

**Endpoint**: `GET /products/top-sold?page=1&limit=20`

## Data Structure

### Product Fields
```typescript
{
  sku: number,              // Sequential: 100001, 100002, etc.
  name: string,             // e.g., "Premium Widget 1"
  slug: string,             // e.g., "premium-widget-1"
  description: string,      // Auto-generated description
  price: number,            // Random $50-$550
  stock: number,            // Random 10-210 units
  lowStockThreshold: 5,
  status: 'active',
  category: ObjectId,       // Random from existing categories
  brand: string,            // Random: TechBrand, QualityPro, etc.
  tags: ['new', 'featured', 'trending'],
  description_images: [{
    url: string,            // Placeholder image
    cover_image: true
  }],
  rating: number,           // Random 3-5 stars
  createdAt: Date,          // For new products: last 30 days
  updatedAt: Date
}
```

### Order Fields
```typescript
{
  user: ObjectId,           // Test user
  products: [{
    product: ObjectId,
    qty: number,            // 1-5 units
    price: number,
    attributes: []
  }],
  shippingAddress: {
    firstName: 'Test',
    lastName: 'Customer',
    phoneNumber: '1234567890',
    address1: '123 Test St',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'USA'
  },
  paymentMethod: 'stripe',
  status: 'Completed',
  totalPrice: number,
  createdAt: Date,          // Week: last 7 days, TopSold: last 180 days
  updatedAt: Date
}
```

## Prerequisites

- MongoDB connection configured in `.env`
- At least one category in the database
- Node.js and TypeScript installed

## Test User

The script creates/uses a test user:
- **Email**: test@example.com
- **Name**: Test User
- **Role**: customer
- **Status**: verified

All orders are created under this user.

## Performance Notes

### Execution Time
- **New Products Only**: ~5-10 seconds
- **Week Products**: ~30-60 seconds (50 products × 5-20 orders = 250-1000 orders)
- **Top Sold Products**: ~2-5 minutes (50 products × 20-100 orders = 1000-5000 orders)
- **Total**: ~3-6 minutes for full simulation

### Database Impact
- **Products**: 50-150 new documents
- **Orders**: 1,250-6,000 new documents
- **Indexes**: Ensure indexes on:
  - `products.status`
  - `products.createdAt`
  - `products.category`
  - `orders.status`
  - `orders.createdAt`
  - `orders.products.product`

## Configuration

Edit the constants at the top of the script:

```typescript
const NEW_PRODUCTS_COUNT = 50;        // Change to create more/fewer new products
const WEEK_PRODUCTS_COUNT = 50;       // Change to create more/fewer week products
const TOP_SOLD_PRODUCTS_COUNT = 50;   // Change to create more/fewer top sold products
```

## Customization

### Change Date Ranges

**New Products** (line ~102):
```typescript
const daysAgo = Math.floor(Math.random() * 30); // Change 30 to desired days
```

**Week Orders** (line ~132):
```typescript
const daysAgo = Math.floor(Math.random() * 7); // Change 7 to desired days
```

**Top Sold Orders** (line ~181):
```typescript
const daysAgo = Math.floor(Math.random() * 180); // Change 180 to desired days
```

### Change Order Quantities

**Week Orders** (line ~130):
```typescript
const orderCount = Math.floor(Math.random() * 16) + 5; // 5-20 orders
// Change to: Math.floor(Math.random() * 31) + 10; // 10-40 orders
```

**Top Sold Orders** (line ~179):
```typescript
const orderCount = Math.floor(Math.random() * 81) + 20; // 20-100 orders
// Change to: Math.floor(Math.random() * 151) + 50; // 50-200 orders
```

### Change Price Range

**Product Price** (line ~92):
```typescript
price: Math.floor(Math.random() * 500) + 50, // $50-$550
// Change to: Math.floor(Math.random() * 200) + 20, // $20-$220
```

### Change Stock Range

**Product Stock** (line ~93):
```typescript
stock: Math.floor(Math.random() * 200) + 10, // 10-210 units
// Change to: Math.floor(Math.random() * 100) + 50, // 50-150 units
```

## Running Multiple Times

The script can be run multiple times:
- **New Products**: Creates new products each time
- **Week/Top Sold**: Reuses existing products if available, creates more if needed
- **Orders**: Always creates new orders (cumulative)

⚠️ **Warning**: Running multiple times will create duplicate orders for the same products, increasing their sales count.

## Cleanup

To remove test data:

```javascript
// Remove test user
db.users.deleteOne({ email: 'test@example.com' });

// Remove products created by script (by SKU range)
db.products.deleteMany({ sku: { $gte: 100000 } });

// Remove orders by test user
const testUserId = db.users.findOne({ email: 'test@example.com' })._id;
db.orders.deleteMany({ user: testUserId });
```

## Troubleshooting

### "No categories found"
Create at least one category first:
```javascript
db.categories.insertOne({
  name: "Electronics",
  slug: "electronics",
  image: "https://via.placeholder.com/400x400.png",
  status: "active"
});
```

### Script runs slowly
- Check MongoDB indexes
- Reduce order counts in configuration
- Run in smaller batches

### "Duplicate key error"
- Products with same slug already exist
- Change the product index offset (line ~92)
- Or delete existing test products first

## Integration Testing

After running the script, test the endpoints:

```bash
# Test new products
curl http://localhost:5000/products/new-products?page=1&limit=10

# Test week products
curl http://localhost:5000/products/top-week?page=1&limit=10

# Test top sold products
curl http://localhost:5000/products/top-sold?page=1&limit=10

# Verify data
curl http://localhost:5000/products/new-products | jq '.meta'
# Should show: { "total": 50+, "page": 1, "limit": 20, "pages": 3+ }
```

## Example Output

```
🚀 Starting product data simulation...

📊 Configuration:
   - New Products: 50
   - Week Products: 50
   - Top Sold Products: 50

✅ Connected to MongoDB
✅ Found existing test user

============================================================
PHASE 1: Creating New Products
============================================================

🔄 Creating 50 new products...
  ✅ Created 10/50 products
  ✅ Created 20/50 products
  ✅ Created 30/50 products
  ✅ Created 40/50 products
  ✅ Created 50/50 products
✅ Created 50 new products

============================================================
PHASE 2: Creating Week Products & Orders
============================================================

🔄 Getting/creating 50 products for week...
✅ Found 50 existing products

🔄 Creating orders for week products (50 products)...
  ✅ Created orders for 10/50 products
  ✅ Created orders for 20/50 products
  ✅ Created orders for 30/50 products
  ✅ Created orders for 40/50 products
  ✅ Created orders for 50/50 products
✅ Created 625 orders for week products

============================================================
PHASE 3: Creating Top Sold Products & Orders
============================================================

🔄 Getting/creating 50 products for topSold...
✅ Found 50 existing products

🔄 Creating orders for top sold products (50 products)...
  ✅ Created orders for 10/50 products
  ✅ Created orders for 20/50 products
  ✅ Created orders for 30/50 products
  ✅ Created orders for 40/50 products
  ✅ Created orders for 50/50 products
✅ Created 3,250 orders for top sold products

============================================================
✅ DATA SIMULATION COMPLETE!
============================================================
📦 New Products: 50 created
📈 Week Products: 50 products with recent orders
🏆 Top Sold Products: 50 products with many orders

🔍 Test the endpoints:
   - GET /products/new-products?page=1&limit=20
   - GET /products/top-week?page=1&limit=20
   - GET /products/top-sold?page=1&limit=20
============================================================

👋 Disconnected from MongoDB
```

---

**Script Complete** ✅  
Realistic test data for product analytics endpoints.
