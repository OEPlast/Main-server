# Logistics API — Use Cases and Examples

Base URL (local): http://localhost:4000

Environment variable for Postman recommended: mainUrl = http://localhost:4000

---

## 1) Populate country/state/city/LGA dropdowns (no prices)

- URL: GET {{mainUrl}}/logistics/locations-tree
- Params: none
- Body (JSON): none

Typical use: Build a cascading address selector in checkout or profile forms.

Sample response:

```json
{
  "message": "Locations retrieved successfully",
  "code": 200,
  "data": [
    {
      "countryCode": "NG",
      "countryName": "Nigeria",
      "states": [
        {
          "name": "Lagos",
          "code": "LA",
          "cities": [
            { "name": "Ikeja", "code": "IKEJA" },
            { "name": "Lekki", "code": "LEKKI" }
          ],
          "lgas": [{ "name": "Eti-Osa", "code": "ETI-OSA" }]
        }
      ]
    }
  ]
}
```

---

## 2) Show supported logistics countries

- URL: GET {{mainUrl}}/logistics/countries
- Params: none
- Body (JSON): none

Use to quickly list countries that have logistics configuration.

Sample response:

```json
{
  "message": "Countries retrieved successfully",
  "code": 200,
  "data": [
    { "countryCode": "NG", "countryName": "Nigeria" },
    { "countryCode": "GH", "countryName": "Ghana" }
  ]
}
```

---

## 3) View logistics config for a country (admin UI helpers)

- URL: GET {{mainUrl}}/logistics/config/{countryCode}
- Path Params:
  - countryCode: string (ISO alpha-2 or alpha-3). Example: NG, US, GH
- Body (JSON): none

Note: Response includes pricing/ETA details and is intended for internal/admin tooling and calculators.

Sample response (shape):

```json
{
  "message": "Logistics config retrieved successfully",
  "code": 200,
  "data": {
    "countryCode": "NG",
    "countryName": "Nigeria",
    "states": [
      {
        "name": "Lagos",
        "code": "LA",
        "fallbackPrice": 1500,
        "fallbackEtaDays": 3,
        "cities": [{ "name": "Ikeja", "code": "IKEJA", "price": 2000, "etaDays": 2 }],
        "lgas": [{ "name": "Eti-Osa", "code": "ETI-OSA", "price": 1800, "etaDays": 2 }]
      }
    ]
  }
}
```

---

## 4) Compute shipping quote at checkout

- URL: POST {{mainUrl}}/logistics/quote
- Params: none
- Body (JSON):

Example A — City-specific pricing

```json
{
  "productId": "66bdc4c3a2a5d572b7d1e9af",
  "quantity": 2,
  "destination": {
    "countryCode": "NG",
    "stateCode": "LA",
    "cityName": "Ikeja"
  }
}
```

Example B — LGA-specific pricing

```json
{
  "productId": "66bdc4c3a2a5d572b7d1e9af",
  "destination": {
    "countryCode": "NG",
    "stateCode": "LA",
    "lgaName": "Eti-Osa"
  }
}
```

Example C — State fallback pricing (no city/LGA match)

```json
{
  "productId": "66bdc4c3a2a5d572b7d1e9af",
  "quantity": 1,
  "destination": {
    "countryCode": "NG",
    "stateCode": "LA"
  }
}
```

Response (shape):

```json
{
  "message": "Quote generated successfully",
  "code": 200,
  "data": {
    "currency": "NGN",
    "basePrice": 1500,
    "productShippingAdjustments": { "addedCost": 0, "increaseCostBy": 0, "addedDays": 0 },
    "finalPrice": 3000,
    "etaDays": 3,
    "breakdown": { "state": 1500, "productAddedCost": 0, "productIncreaseCostBy": 0 }
  }
}
```

Notes:

- The service applies specificity: city > LGA > state fallback.
- Product shipping modifiers (addedCost, increaseCostBy, addedDays) are included in the result.

More examples and edge cases:

- Example D — Unknown city but known LGA provided (LGA wins when city doesn’t match)

```json
{
  "productId": "66bdc4c3a2a5d572b7d1e9af",
  "destination": {
    "countryCode": "NG",
    "stateCode": "LA",
    "cityName": "UnknownCity",
    "lgaName": "Eti-Osa"
  }
}
```

- Example E — Missing stateCode (no state fallback available). Base price may be 0 if no city/LGA match; include stateCode for meaningful quotes.

```json
{
  "productId": "66bdc4c3a2a5d572b7d1e9af",
  "destination": {
    "countryCode": "NG",
    "cityName": "Ikeja"
  }
}
```

- Example F — Quantity omitted (defaults to 1)

```json
{
  "productId": "66bdc4c3a2a5d572b7d1e9af",
  "destination": {
    "countryCode": "NG",
    "stateCode": "LA",
    "cityName": "Ikeja"
  }
}
```

- Example G — Product shipping modifiers in effect (addedCost, increaseCostBy, addedDays). Final price is (basePrice + basePrice*(increase/100) + addedCost) * quantity.

```json
{
  "productId": "66bdc4c3a2a5d572b7d1e9af",
  "quantity": 3,
  "destination": {
    "countryCode": "NG",
    "stateCode": "LA",
    "lgaName": "Eti-Osa"
  }
}
```

Validation rules (400 on failure):

- productId: required string
- quantity: optional int >= 1
- destination.countryCode: required string length 2-3
- destination.stateCode, destination.cityName, destination.lgaName: optional strings

Sample 400 response:

```json
{
  "message": "Validation failed",
  "errors": [
    {
      "type": "field",
      "msg": "Invalid value",
      "path": "destination.countryCode",
      "location": "body"
    }
  ]
}
```

Other error cases:

- 404 Product not found
- 404 Logistics config not found for country
- 200 with basePrice 0 when no matching state/city/LGA and no state fallback exists

---

## 5) Track a shipment by tracking number

- URL: GET {{mainUrl}}/logistics/track/{trackingNumber}
- Path Params:
  - trackingNumber: string (provided by carrier/creation)
- Body (JSON): none

Use in order detail pages to display tracking updates.

Sample response (shape):

```json
{
  "message": "Shipment tracking information retrieved successfully",
  "code": 200,
  "data": {
    "trackingNumber": "TRK1724371029ABCDE",
    "status": "in_transit",
    "estimatedDelivery": "2025-08-29T00:00:00.000Z",
    "trackingHistory": [
      { "status": "pending", "description": "Shipment created", "timestamp": "2025-08-23T10:00:00.000Z" },
      { "status": "in_transit", "description": "Left sorting center", "timestamp": "2025-08-24T15:34:00.000Z" }
    ]
  }
}
```

---

## Admin — Logistics (management endpoints)

Headers (all admin requests):

- Authorization: Bearer {{token}}
- Content-Type: application/json

### 6) List supported countries (admin)

- URL: GET {{mainUrl}}/admin/logistics/countries
- Params: none
- Body: none

Use to populate admin country selector where logistics configs exist.

Sample response:

```json
{
  "message": "Countries retrieved successfully",
  "code": 200,
  "data": [{ "countryCode": "NG", "countryName": "Nigeria" }]
}
```

---

### 7) Get logistics config by country (admin)

- URL: GET {{mainUrl}}/admin/logistics/{countryCode}
- Path Params:
  - countryCode: string (ISO alpha-2 or alpha-3). Example: NG, US, GH
- Body: none

Example: GET {{mainUrl}}/admin/logistics/NG

Error cases:

- 404 when country config not found

---

### 8) Create logistics config (admin)

- URL: POST {{mainUrl}}/admin/logistics/config
- Params: none
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

Notes:

- Creates a new config; if the country already exists, expect 409 conflict.
- At runtime, quotes honor specificity: city > LGA > state fallback.

Additional example payloads:

Minimal — state fallback only

```json
{
  "countryCode": "GH",
  "countryName": "Ghana",
  "states": [{ "name": "Greater Accra", "code": "GA", "fallbackPrice": 1000, "fallbackEtaDays": 4 }]
}
```

LGAs only

```json
{
  "countryCode": "NG",
  "countryName": "Nigeria",
  "states": [
    {
      "name": "Lagos",
      "code": "LA",
      "lgas": [
        { "name": "Ikeja", "code": "IKEJA", "price": 1800, "etaDays": 2 },
        { "name": "Eti-Osa", "code": "ETI-OSA", "price": 1700, "etaDays": 3 }
      ]
    }
  ]
}
```

Cities only

```json
{
  "countryCode": "NG",
  "countryName": "Nigeria",
  "states": [
    {
      "name": "Abuja",
      "code": "FC",
      "cities": [{ "name": "Garki", "code": "GARKI", "price": 1400, "etaDays": 3 }]
    }
  ]
}
```

---

### 9) Update logistics config by id (admin)

- URL: PATCH {{mainUrl}}/admin/logistics/config/{id}
- Path Params:
  - id: string (Mongo ObjectId of the config document)
- Body (JSON) — partial update allowed, e.g.:

```json
{
  "countryName": "Nigeria",
  "states": [
    {
      "name": "Lagos",
      "code": "LA",
      "fallbackPrice": 1600,
      "cities": [
        { "name": "Ikeja", "price": 2100 },
        { "name": "Lekki", "etaDays": 3 }
      ]
    }
  ]
}
```

More examples:

- Change country code (uppercased server-side)

```json
{ "countryCode": "ng" }
```

- Replace states array entirely (PATCH replaces provided arrays; it does not merge nested arrays):

```json
{
  "states": [
    {
      "name": "Rivers",
      "code": "RI",
      "fallbackPrice": 1300,
      "fallbackEtaDays": 4
    }
  ]
}
```

Error cases:

- 404 when config id not found
- 400 when body doesn’t include at least one of [countryCode, countryName, states]

Note: When sending the "states" key, the server sets the states array to exactly what you send.

---

### 10) Create empty country (admin)

- URL: POST {{mainUrl}}/admin/logistics/country/add
- Body (JSON):

```json
{ "countryCode": "US", "countryName": "United States" }
```

Responses:

- 201 on success
- 409 when country already exists

---

### 11) Update country name (admin)

- URL: PATCH {{mainUrl}}/admin/logistics/country/{countryCode}
- Body (JSON):

```json
{ "countryName": "United States of America" }
```

Responses:

- 200 on success
- 404 when country not found

---

### 12) Delete country (admin)

- URL: DELETE {{mainUrl}}/admin/logistics/country/{countryCode}

Responses:

- 200 on success
- 404 when country not found

---

## Quick table

- GET /logistics/locations-tree — cascade dropdown (no body)
- GET /logistics/countries — list of countries (no body)
- GET /logistics/config/{countryCode} — view raw config (no body)
- POST /logistics/quote — compute quote (see body examples above)
- GET /logistics/track/{trackingNumber} — fetch tracking status (no body)

Admin quick table

- GET /admin/logistics/countries — list managed countries (no body)
- GET /admin/logistics/{countryCode} — fetch config (no body)
- POST /admin/logistics/config — create config (see body example above)
- PATCH /admin/logistics/config/{id} — update config by id (partial)
- POST /admin/logistics/country/add — create empty country
- PATCH /admin/logistics/country/{countryCode} — update country name
- DELETE /admin/logistics/country/{countryCode} — delete country
