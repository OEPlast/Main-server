# Logistics API — Use Cases and Examples

Base URL (local): http://localhost:4000

Environment variable for Postman recommended: mainUrl = http://localhost:4000

---

## 1) Populate country/state/city/LGA dropdowns (no prices)

- URL: GET {{mainUrl}}/logistics/locations-tree
- Params: none
- Body (JSON): none

Typical use: Build a cascading address selector in checkout or profile forms.

---

## 2) Show supported logistics countries

- URL: GET {{mainUrl}}/logistics/countries
- Params: none
- Body (JSON): none

Use to quickly list countries that have logistics configuration.

---

## 3) View logistics config for a country (admin UI helpers)

- URL: GET {{mainUrl}}/logistics/config/{countryCode}
- Path Params:
  - countryCode: string (ISO alpha-2 or alpha-3). Example: NG, US, GH
- Body (JSON): none

Note: Response includes pricing/ETA details and is intended for internal/admin tooling and calculators.

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

---

## 5) Track a shipment by tracking number

- URL: GET {{mainUrl}}/logistics/track/{trackingNumber}
- Path Params:
  - trackingNumber: string (provided by carrier/creation)
- Body (JSON): none

Use in order detail pages to display tracking updates.

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

---

### 7) Get logistics config by country (admin)

- URL: GET {{mainUrl}}/admin/logistics/{countryCode}
- Path Params:
  - countryCode: string (ISO alpha-2 or alpha-3). Example: NG, US, GH
- Body: none

Example: GET {{mainUrl}}/admin/logistics/NG

---

### 8) Upsert logistics config (admin create/replace)

- URL: PUT {{mainUrl}}/admin/logistics
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

- Upsert replaces or creates the full config for the country.
- At runtime, quotes honor specificity: city > LGA > state fallback.

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
- PUT /admin/logistics — upsert config (see body example above)
