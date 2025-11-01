# Deals of the Day Campaign Setup

## Overview

This implementation creates a "Deals of the Day" campaign system that:
1. Selects random products from the database
2. Creates sales entries with discounts (10-50% off)
3. Creates/updates a "Deals of the Day" campaign
4. Provides an API endpoint to fetch campaign products (paginated)
5. Displays campaign products on the storefront homepage

## Setup & Usage

### 1. Run the Seed Script

The script creates a "Deals of the Day" campaign with 20 random products:

```bash
cd old-main-server
ts-node scripts/create-deals-of-the-day.ts
```

**What the script does:**
- Fetches 20 random active products with stock > 0
- Creates sale entries for each product with random discounts (10-50%)
- Sets sale type to "Limited" with 24-hour validity
- Creates/updates the "Deals of the Day" campaign
- Links all sales to the campaign

**Prerequisites:**
- MongoDB connection configured in `.env`
- At least one admin user exists in the database
- Active products with stock > 0 exist

### 2. API Endpoint

**Endpoint:** `GET /products/deals-of-the-day`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "message": "Deals of the Day products retrieved successfully",
  "data": [
    {
      "_id": "...",
      "name": "Product Name",
      "slug": "product-slug",
      "price": 99.99,
      "image": "https://...",
      "sku": "SKU123",
      "stock": 50,
      "rating": 4.5,
      "category": {
        "_id": "...",
        "name": "Category",
        "slug": "category-slug",
        "image": "https://..."
      },
      "sale": {
        "_id": "...",
        "title": "30% OFF - Product Name",
        "isActive": true,
        "type": "Limited",
        "campaign": "...",
        "startDate": "2025-10-31T00:00:00.000Z",
        "endDate": "2025-11-01T00:00:00.000Z",
        "variants": [
          {
            "attributeName": null,
            "attributeValue": null,
            "discount": 30,
            "amountOff": 0,
            "maxBuys": 100,
            "boughtCount": 0
          }
        ]
      }
    }
  ],
  "meta": {
    "total": 20,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### 3. Storefront Integration

The storefront automatically:
- **Prefetches** campaign data on server (5-minute cache)
- **Displays** "Deals of the Day" section at the top of homepage
- **Shows countdown timer** for the campaign (if start/end dates exist)
- **Renders products** with sale information and discounts

**Files Modified:**
- `storefront/src/libs/api/endpoints.ts` - Added endpoint
- `storefront/src/hooks/queries/useProductLists.ts` - Added `useDealsOfTheDay` hook
- `storefront/src/provider/Server-queries.tsx` - Added server prefetch
- `storefront/src/app/HomeClient.tsx` - Added component render

## Campaign Management

### Update Campaign

To refresh the campaign with new products, simply run the script again:

```bash
ts-node scripts/create-deals-of-the-day.ts
```

The script will:
- Update existing campaign if found
- Replace products and sales with new random selection
- Reset campaign dates to current + 24 hours

### Manual Campaign Management

You can also manage campaigns through MongoDB:

```javascript
// Find the campaign
db.campaigns.findOne({ title: "Deals of the Day" });

// Update campaign status
db.campaigns.updateOne(
  { title: "Deals of the Day" },
  { $set: { status: "inactive" } }
);

// Extend campaign duration
db.campaigns.updateOne(
  { title: "Deals of the Day" },
  { $set: { endDate: new Date("2025-11-02") } }
);
```

### Deactivate Campaign

To stop showing deals:

```javascript
// Deactivate campaign
db.campaigns.updateOne(
  { title: "Deals of the Day" },
  { $set: { status: "inactive" } }
);

// Or deactivate all sales
db.sales.updateMany(
  { campaign: campaignId },
  { $set: { isActive: false } }
);
```

## Architecture

### Backend Flow

```
1. Client Request
   ↓
2. ProductController.getDealsOfTheDay()
   ↓
3. ProductService.getDealsOfTheDay()
   ↓
4. Find active "Deals of the Day" campaign
   ↓
5. Aggregate products with sales data
   ↓
6. Return paginated results
```

### Frontend Flow

```
1. Server Prefetch (ServerQueries)
   ↓
2. Fetch /products/deals-of-the-day
   ↓
3. Cache in React Query (5min staleTime)
   ↓
4. HomeClient uses useDealsOfTheDay hook
   ↓
5. ProductSection renders campaign products
   ↓
6. CountdownTimer shows time remaining
```

## Customization

### Change Campaign Duration

Edit the script at line ~154:

```typescript
startDate: new Date(),
endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Change this
```

### Change Number of Products

Edit the script at line ~17:

```typescript
const PRODUCTS_TO_SELECT = 20; // Change this
```

### Change Discount Range

Edit the script at line ~91:

```typescript
const discount = Math.floor(Math.random() * 41) + 10; // 10-50%
// Example: Math.floor(Math.random() * 31) + 20; // 20-50%
```

### Change Campaign Name

Edit the script at line ~18-19:

```typescript
const CAMPAIGN_NAME = 'Deals of the Day';
const CAMPAIGN_DESCRIPTION = 'Limited time offers on selected products - up to 50% off!';
```

Then update the service at `productService.ts` line ~1313:

```typescript
const campaign = await Campaign.findOne({
  title: 'Deals of the Day', // Change this
  status: 'active',
  // ...
});
```

## Troubleshooting

### Campaign Not Showing

1. Check campaign exists and is active:
```bash
mongo
use oeplast
db.campaigns.findOne({ title: "Deals of the Day" })
```

2. Verify campaign dates are valid:
```javascript
db.campaigns.findOne({
  title: "Deals of the Day",
  startDate: { $lte: new Date() },
  endDate: { $gte: new Date() }
})
```

3. Check sales are active:
```javascript
db.sales.find({ campaign: campaignId, isActive: true })
```

### No Products in Response

1. Verify products exist in campaign:
```javascript
db.campaigns.findOne({ title: "Deals of the Day" }, { products: 1 })
```

2. Check products are active and in stock:
```javascript
db.products.find({
  _id: { $in: productIds },
  status: "active",
  stock: { $gt: 0 }
})
```

### Script Fails

Common issues:
- **No admin user**: Create an admin user first
- **No products**: Add products to database
- **MongoDB connection**: Check `MONGODB_URI` in `.env`
- **Permission errors**: Ensure write permissions on database

## Automation (Optional)

### Daily Campaign Refresh

Add a cron job to refresh the campaign daily:

```bash
# Edit crontab
crontab -e

# Add line (runs daily at midnight)
0 0 * * * cd /path/to/old-main-server && ts-node scripts/create-deals-of-the-day.ts
```

### Using Node Cron

Create a scheduled task in your server:

```typescript
import cron from 'node-cron';
import { exec } from 'child_process';

// Run daily at midnight
cron.schedule('0 0 * * *', () => {
  exec('ts-node scripts/create-deals-of-the-day.ts', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    console.log(stdout);
  });
});
```

## Testing

### Test API Endpoint

```bash
# Test with curl
curl http://localhost:5000/products/deals-of-the-day?page=1&limit=10

# Test with HTTPie
http GET http://localhost:5000/products/deals-of-the-day page==1 limit==10
```

### Test Frontend

1. Start backend: `cd old-main-server && npm run dev`
2. Start frontend: `cd storefront && npm run dev`
3. Visit: `http://localhost:3009`
4. Check "Deals of the Day" section appears at top

## Performance Notes

- **Server Prefetch**: Campaign data loaded on server before page render
- **Cache Duration**: 5 minutes (shorter for time-sensitive deals)
- **Pagination**: Default 20 items per page to balance load and UX
- **Aggregation**: Uses MongoDB aggregation pipeline for efficiency

## Future Enhancements

1. **Multiple Campaigns**: Support multiple active campaigns simultaneously
2. **Scheduled Activation**: Auto-activate campaigns at specific times
3. **Analytics**: Track campaign performance and sales
4. **A/B Testing**: Test different discount ranges
5. **Push Notifications**: Notify users when new deals go live
6. **Email Campaigns**: Send daily deals email to subscribers

---

**Implementation Complete** ✅  
Campaign system fully integrated with backend API and storefront display.
