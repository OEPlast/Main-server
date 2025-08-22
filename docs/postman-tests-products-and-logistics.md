# Postman Tests — Products & Logistics

Base URL

- {{mainurl}} = http://localhost:4000

Auth

- For admin endpoints, include header: Authorization: Bearer {{token}}
- Content-Type: application/json where body is present

---

## Public — Products

### 1) List products

- Method: GET
- URL: {{mainurl}}/products
- Query params (optional):
  - page: number (min 1)
  - limit: number (1-100)
  - category: string (categoryId)
  - subcategory: string (subcategoryId)
  - search: string (>= 2 chars)
  - minPrice: number
  - maxPrice: number
  - sortBy: one of [price, name, createdAt, rating, sales]
  - sortOrder: one of [asc, desc]
  - availability: one of [in-stock, out-of-stock, low-stock]

Use cases:

- List all products: {{mainurl}}/products?page=1&limit=20
- Filter by category: {{mainurl}}/products?category={{categoryId}}
- Price range: {{mainurl}}/products?minPrice=1000&maxPrice=5000

---

### 2) Search products (with optional filter body)

- Method: GET
- URL: {{mainurl}}/products/search?q={{text}}
- Query params:
  - q: string (>= 2 chars)
  - page?: number (default 1)
  - limit?: number (default 10)
- Body (optional, JSON) — filters accepted by the API:

```json
{
  "filters": {
    "priceRange": { "min": 1000, "max": 5000 },
    "category": "{{categoryId}}",
    "subCategory": "{{subCategoryId}}",
    "brand": "Acme",
    "attributes": { "Color": "Blue" },
    "tags": ["bestseller", "eco"],
    "sortBy": "newest"
  }
}
```

Examples:

- {{mainurl}}/products/search?q=bag&page=1&limit=12
- With filters body as above

---

### 3) Products by category slug (with descendants)

- Method: GET
- URL: {{mainurl}}/products/category/{{slug}}
- Query params (optional):
  - page: number (default 1)
  - limit: number (1-100, default 20)
  - sort: one of [newest, price_asc, price_desc, popular]

Use cases:

- {{mainurl}}/products/category/luggage?page=1&limit=24&sort=newest
- {{mainurl}}/products/category/luggage?sort=popular

---

### 4) Products by category and subcategory (IDs)

- Method: GET
- URL: {{mainurl}}/products/categoryNSub/{{categoryId}}/{{subCategoryId}}
- Query params:
  - page?: number (default 1)
  - limit?: number (default 10)

Examples:

- {{mainurl}}/products/categoryNSub/{{categoryId}}/{{subCategoryId}}?page=1&limit=20

---

### 5) Get product by ID

- Method: GET
- URL: {{mainurl}}/products/{{id}}

---

### 6) Week/Top Sold/Hot Sales

- Method: GET — {{mainurl}}/products/week
- Method: GET — {{mainurl}}/products/top-sold
- Method: GET — {{mainurl}}/products/hot-sales

---

### 7) Recommendations

- Method: GET — {{mainurl}}/products/recommendation
- Method: GET — {{mainurl}}/products/recommendation4u

Note: Implementation may vary; typically uses user context or current product to compute recommendations.

---

## Admin — Products

Headers (all):

- Authorization: Bearer {{token}}
- Content-Type: application/json

### 1) Create product

- Method: POST
- URL: {{mainurl}}/admin/product/create
- Body (JSON):

```json
{
  "sku": 1001001,
  "name": "Travel Backpack X",
  "description": "Durable backpack with multiple compartments",
  "brand": "Acme",
  "price": 24999,
  "category": "{{categoryId}}",
  "tags": ["travel", "backpack"],
  "description_images": [
    { "url": "https://cdn.example.com/img1.jpg", "cover_image": true },
    { "url": "https://cdn.example.com/img2.jpg" }
  ],
  "specifications": [
    { "key": "Material", "value": "HDPE" },
    { "key": "Capacity", "value": "35L" }
  ],
  "dimension": [
    { "key": "length", "value": "45 cm" },
    { "key": "width", "value": "30 cm" },
    { "key": "height", "value": "18 cm" },
    { "key": "weight", "value": "0.9 kg" }
  ],
  "shipping": {
    "addedCost": 500,
    "increaseCostBy": 100,
    "addedDays": 2
  },
  "attributes": [
    {
      "name": "Color",
      "children": [
        { "name": "Black", "stock": 50, "image": "https://cdn.example.com/black.jpg" },
        { "name": "Blue", "stock": 30, "image": "https://cdn.example.com/blue.jpg", "discount": 5 }
      ]
    }
  ],
  "pricingTiers": [
    { "minQty": 5, "maxQty": 10, "strategy": "percentOff", "value": 3 },
    { "minQty": 11, "maxQty": 50, "strategy": "percentOff", "value": 7 },
    { "minQty": 51, "strategy": "percentOff", "value": 12 }
  ],
  "stock": 100,
  "lowStockThreshold": 5,
  "discount": 0
}
```

More create use-cases

1. No dimensions, fixedPrice tier

```json
{
  "sku": 2002001,
  "name": "Carry-on Case",
  "description": "Lightweight hard-shell carry-on",
  "brand": "Acme",
  "price": 39999,
  "category": "{{categoryId}}",
  "shipping": { "addedCost": 0, "increaseCostBy": 0, "addedDays": 0 },
  "attributes": [],
  "pricingTiers": [{ "minQty": 10, "strategy": "fixedPrice", "value": 34999 }],
  "stock": 50
}
```

2. With dimensions only, amountOff tier

```json
{
  "sku": 3003001,
  "name": "Storage Box XL",
  "description": "Stackable storage box",
  "brand": "Boxy",
  "price": 9999,
  "category": "{{categoryId}}",
  "dimension": [
    { "key": "length", "value": "60 cm" },
    { "key": "width", "value": "40 cm" },
    { "key": "height", "value": "30 cm" }
  ],
  "pricingTiers": [
    { "minQty": 20, "maxQty": 49, "strategy": "amountOff", "value": 500 },
    { "minQty": 50, "strategy": "amountOff", "value": 1200 }
  ],
  "stock": 200
}
```

3. Variant-level tiers (percentOff at variant), product has none

```json
{
  "sku": 4004001,
  "name": "T-Shirt",
  "description": "Cotton tee",
  "brand": "ClothCo",
  "price": 5000,
  "category": "{{categoryId}}",
  "attributes": [
    {
      "name": "Color",
      "children": [
        {
          "name": "White",
          "stock": 100,
          "image": "https://cdn.example.com/white.jpg",
          "pricingTiers": [
            { "minQty": 10, "maxQty": 49, "strategy": "percentOff", "value": 5 },
            { "minQty": 50, "strategy": "percentOff", "value": 12 }
          ]
        },
        { "name": "Black", "stock": 80, "image": "https://cdn.example.com/black.jpg" }
      ]
    }
  ],
  "stock": 180
}
```

4. With shippingCost increase and open-ended tier

```json
{
  "sku": 5005001,
  "name": "Bulk Screws Pack",
  "description": "Assorted screws",
  "brand": "FixIt",
  "price": 1999,
  "category": "{{categoryId}}",
  "shipping": { "addedCost": 200, "increaseCostBy": 10, "addedDays": 1 },
  "pricingTiers": [
    { "minQty": 5, "maxQty": 9, "strategy": "percentOff", "value": 5 },
    { "minQty": 10, "strategy": "percentOff", "value": 15 }
  ],
  "stock": 500
}
```

5. Minimal product (no images, no attributes, no dimensions)

```json
{
  "sku": 6006001,
  "name": "Basic Mug",
  "description": "Ceramic mug",
  "price": 1500,
  "category": "{{categoryId}}",
  "stock": 25
}
```

6. Variant-rich with per-variant fixedPrice tiers

```json
{
  "sku": 7007001,
  "name": "Laptop Sleeve",
  "description": "Neoprene sleeve",
  "brand": "Protecto",
  "price": 8000,
  "category": "{{categoryId}}",
  "attributes": [
    {
      "name": "Size",
      "children": [
        {
          "name": "13-inch",
          "stock": 40,
          "image": "https://cdn.example.com/13.jpg",
          "pricingTiers": [{ "minQty": 10, "strategy": "fixedPrice", "value": 7000 }]
        },
        {
          "name": "15-inch",
          "stock": 35,
          "image": "https://cdn.example.com/15.jpg",
          "pricingTiers": [
            { "minQty": 20, "maxQty": 49, "strategy": "fixedPrice", "value": 7200 },
            { "minQty": 50, "strategy": "fixedPrice", "value": 6800 }
          ]
        }
      ]
    }
  ],
  "stock": 75
}
```

### 2) Get product by id

- Method: GET
- URL: {{mainurl}}/admin/product/{{id}}

### 3) Update product (partial)

- Method: PATCH
- URL: {{mainurl}}/admin/product/{{id}}
- Body (JSON):

```json
{
  "price": 21999,
  "discount": 10,
  "tags": ["featured", "spring-sale"],
  "shipping": { "addedCost": 600, "addedDays": 3 }
}
```

More update use-cases

1. Update only pricing tiers (introduce open-ended)

```json
{
  "pricingTiers": [
    { "minQty": 5, "maxQty": 9, "strategy": "percentOff", "value": 4 },
    { "minQty": 10, "strategy": "percentOff", "value": 10 }
  ]
}
```

2. Update variant-level tiers for a specific attribute/child

```json
{
  "attributes": [
    {
      "name": "Color",
      "children": [{ "name": "Blue", "pricingTiers": [{ "minQty": 20, "strategy": "amountOff", "value": 700 }] }]
    }
  ]
}
```

3. Replace dimensions and adjust shipping

```json
{
  "dimension": [
    { "key": "length", "value": "48 cm" },
    { "key": "width", "value": "32 cm" },
    { "key": "height", "value": "20 cm" },
    { "key": "weight", "value": "1.1 kg" }
  ],
  "shipping": { "addedCost": 750, "increaseCostBy": 5, "addedDays": 0 }
}
```

4. Add specifications and tags together

```json
{
  "specifications": [
    { "key": "Material", "value": "Aluminum" },
    { "key": "Origin", "value": "NG" }
  ],
  "tags": ["premium", "limited"]
}
```

### 4) Delete product

- Method: DELETE
- URL: {{mainurl}}/admin/product/{{id}}

### 5) Duplicate product

- Method: POST
- URL: {{mainurl}}/admin/product/duplicate/{{id}}

### 6) Update cover image (atomic)

- Method: PATCH
- URL: {{mainurl}}/admin/product/coverImage/update/{{id}}
- Body (JSON):

```json
{ "imageUrl": "https://cdn.example.com/img2.jpg" }
```

### 7) Add tags (array edit)

- Method: POST
- URL: {{mainurl}}/admin/product/{{productId}}/tags
- Body (JSON):

```json
{ "tags": ["new-arrival", "carry-on"] }
```

### 8) Remove a tag (array edit)

- Method: DELETE
- URL: {{mainurl}}/admin/product/{{productId}}/tags/{{tag}}

### 9) Add specifications (array edit)

- Method: POST
- URL: {{mainurl}}/admin/product/{{productId}}/specifications
- Body (JSON):

```json
{
  "specifications": [
    { "key": "Warranty", "value": "12 months" },
    { "key": "Country", "value": "NG" }
  ]
}
```

### 10) Remove specification (array edit)

- Method: DELETE
- URL: {{mainurl}}/admin/product/{{productId}}/specifications
- Body (JSON):

```json
{ "key": "Warranty" }
```

---

## Public — Logistics

### 1) Locations tree (lightweight, no price)

- Method: GET
- URL: {{mainurl}}/logistics/locations-tree

### 2) Get logistics config by country

- Method: GET
- URL: {{mainurl}}/logistics/config/{{countryCode}}
- Example: {{mainurl}}/logistics/config/NG

### 3) Get shipping quote for a product and destination

- Method: POST
- URL: {{mainurl}}/logistics/quote
- Body (JSON) — example:

```json
{
  "countryCode": "NG",
  "destination": {
    "stateCode": "LA",
    "lgaCode": "IKEJA",
    "cityCode": "IKEJA"
  },
  "product": {
    "weight": 2.5,
    "dimensions": { "length": 20, "width": 15, "height": 10 },
    "quantity": 3,
    "shipping": { "addedCost": 500, "increaseCostBy": 100, "addedDays": 2 }
  }
}
```

## Admin — Logistics

Headers (all):

- Authorization: Bearer {{token}}
- Content-Type: application/json

### 1) List supported countries

- Method: GET
- URL: {{mainurl}}/admin/logistics/countries

Use cases:

- {{mainurl}}/admin/logistics/countries

### 2) Get logistics config by country

- Method: GET
- URL: {{mainurl}}/admin/logistics/{{countryCode}}
- Example: {{mainurl}}/admin/logistics/NG

### 3) Upsert logistics config (create or replace for a country)

- Method: PUT
- URL: {{mainurl}}/admin/logistics
- Body (JSON):

```json
{
  "countryCode": "NG",
  "countryName": "Nigeria",
  "states": [
    {
      "name": "Lagos",
      "code": "LA",
      "fallbackPrice": 1500,
      "fallbackEtaDays": 3,
      "cities": [
        { "name": "Ikeja", "code": "IKEJA", "price": 2000, "etaDays": 2 },
        { "name": "Lekki", "code": "LEKKI" }
      ],
      "lgas": [{ "name": "Ikeja", "code": "IKEJA", "price": 1800, "etaDays": 2 }]
    },
    {
      "name": "Abuja",
      "code": "FC",
      "fallbackPrice": 1200,
      "fallbackEtaDays": 4
    }
  ]
}
```

Notes

- Products slug endpoint supports sort: newest | price_asc | price_desc | popular.
- Admin endpoints require proper role/permission in addition to auth.
- IDs should be valid MongoDB ObjectIds.
