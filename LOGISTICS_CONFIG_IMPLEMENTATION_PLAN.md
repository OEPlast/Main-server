# Logistics Configuration Management System - Complete Implementation Plan

## 📋 Table of Contents

1. [Overview](#overview)
2. [Backend Status](#backend-status)
3. [Frontend Implementation Plan](#frontend-implementation-plan)
4. [API Reference](#api-reference)
5. [File Summary](#file-summary)
6. [Testing Guidelines](#testing-guidelines)

---

## Overview

### Goal

Integrate the existing backend logistics configuration system into the admin dashboard UI, enabling admins to manage shipping locations (Countries → States → LGAs → Cities) and their associated pricing/ETA configurations.

### Key Features

- ✅ **Backend COMPLETED**: Hierarchical location model (Country → State → LGA → City)
- ✅ **Backend COMPLETED**: Fallback pricing system (City → LGA → State)
- ✅ **Backend COMPLETED**: Product-specific shipping modifiers
- ✅ **Backend COMPLETED**: Progressive shipping calculation for carts
- 🔨 **Frontend TODO**: Admin UI for CRUD operations on logistics configurations
- 🔨 **Frontend TODO**: API integration using React Query
- 🔨 **Frontend TODO**: Form validation and data display

### Tech Stack

**Backend**: Node.js + Express + TypeScript + MongoDB (✅ COMPLETE)  
**Frontend**: Next.js 15 + React 19 + React Query + Zustand + Rizzui + Zod

### Use Cases

1. **Admin**: Manage countries, states, LGAs, and cities with shipping prices
2. **System**: Calculate accurate shipping costs based on location hierarchy
3. **Cart**: Use logistics data to determine final shipping price with progressive pricing

---

## Backend Status

### ✅ Completed Backend Components

#### 1. Database Model

**File**: `src/models/LogisticsConfig.ts`

**Schema Structure**:

```typescript
LogisticsConfig {
  countryCode: String (unique, indexed, uppercase)
  countryName: String (unique, indexed)
  states: [
    {
      name: String (required)
      code: String (required, uppercase)
      fallbackPrice: Number (min: 0, default: 0)
      fallbackEtaDays: Number (min: 0, default: 0)
      cities: [
        {
          name: String (required)
          code: String
          price: Number (min: 0)
          etaDays: Number (min: 0)
        }
      ]
      lgas: [
        {
          name: String (required)
          code: String
          price: Number (min: 0)
          etaDays: Number (min: 0)
        }
      ]
    }
  ]
}
```

**Type Export**: `LogisticsConfigType`

---

#### 2. Service Layer

**File**: `src/services/LogisticsService.ts`

**Methods Available**:

**1. `getConfigByCountry(country: string)`**

- Returns: Full logistics config for a country
- Use case: Admin viewing/editing a specific country

**2. `createConfig(payload: LogisticsConfigType)`**

- Creates: New logistics config for a country
- Validation: Checks for duplicate country code/name
- Use case: Admin adding a new country

**3. `updateConfig(id: string, payload: Partial<LogisticsConfigType>)`**

- Updates: Existing logistics config by MongoDB \_id
- Fields: countryCode, countryName, states array
- Use case: Admin editing country details

**4. `listCountries()`**

- Returns: Array of `{ _id, countryCode, countryName }`
- Use case: Admin country list view, dropdowns

**5. `createEmptyCountry(countryCode: string, countryName: string)`**

- Creates: Empty country with no states
- Use case: Admin creating country shell before adding states

**6. `deleteCountry(id: string)`**

- Deletes: Entire country config by MongoDB \_id
- Use case: Admin removing unsupported countries

**7. `quote(input: QuoteInput)`**

- Calculates: Shipping price for single product with location
- Input: `{ productId, quantity?, destination: { countryName, stateCode?, cityName?, lgaName? } }`
- Returns: `{ basePrice, finalPrice, etaDays, breakdown, productShippingAdjustments }`
- Use case: Product page shipping estimate

**8. `listLocationsTree()`**

- Returns: All countries with states, LGAs, cities (no pricing)
- Use case: Public location picker in checkout

**9. `calculateProgressiveShipping(items, destination)`**

- Calculates: Total cart shipping with progressive pricing
- Input: `items: [{ productId, quantity }]`, `destination: { countryName, stateCode, lgaName }`
- Returns: Final shipping amount (Number)
- Use case: Cart checkout shipping calculation

---

#### 3. Validators

**File**: `src/validators/admin/logistics.ts`

**Validators Available**:

**1. `upsertConfigValidator`**

- For: POST `/admin/logistics/config` (create full config)
- Validates: countryCode, countryName, states array with nested cities/lgas

**2. `updateConfigPartialValidator`**

- For: PATCH `/admin/logistics/config/:id` (partial update)
- Validates: At least one of countryCode, countryName, or states

**3. `getByCountryValidator`**

- For: GET `/admin/logistics/one/:country`
- Validates: country param as string

**4. `createEmptyCountryValidator`**

- For: POST `/admin/logistics/country/add`
- Validates: countryCode (2-3 chars), countryName (min 2 chars)

**5. `deleteCountryValidator`**

- For: DELETE `/admin/logistics/country/:id`
- Validates: id param as MongoId

**6. `updateConfigIdValidator`**

- For: PATCH `/admin/logistics/config/:id`
- Validates: id param as MongoId

---

#### 4. Controllers

**File**: `src/controller/admin/LogisticsController.ts`

**Endpoints Available**:

| Method | Route                           | Controller           | Purpose                            |
| ------ | ------------------------------- | -------------------- | ---------------------------------- |
| GET    | `/admin/logistics/countries`    | `listCountries`      | Get all countries (id, code, name) |
| GET    | `/admin/logistics/one/:country` | `getByCountry`       | Get full config for one country    |
| POST   | `/admin/logistics/config`       | `createConfig`       | Create full logistics config       |
| PATCH  | `/admin/logistics/config/:id`   | `updateConfig`       | Update config by MongoDB \_id      |
| POST   | `/admin/logistics/country/add`  | `createEmptyCountry` | Create empty country shell         |
| DELETE | `/admin/logistics/country/:id`  | `deleteCountry`      | Delete country by MongoDB \_id     |

**Authentication**: All routes require `authenticateUser` + `isAdmin` middleware

---

#### 5. Public User Endpoints

**File**: `src/controller/LogisticsController.ts`

| Method | Route                              | Purpose                                          |
| ------ | ---------------------------------- | ------------------------------------------------ |
| GET    | `/logistics/countries`             | List all countries (public)                      |
| GET    | `/logistics/locations-tree`        | Get location hierarchy without prices            |
| GET    | `/logistics/config/:country`       | Get logistics config by country name             |
| POST   | `/logistics/quote`                 | Get shipping quote for single product            |
| POST   | `/logistics/cart/flat-shipping`    | Calculate cart shipping with progressive pricing |
| GET    | `/logistics/track/:trackingNumber` | Track shipment by tracking number                |

---

## Frontend Implementation Plan

### Phase 1: TypeScript Types & Interfaces

**Task 1.1: Create Logistics Types**  
**File**: `apps/isomorphic/src/types/logistics.ts` _(NEW FILE)_

```typescript
// Base location interfaces
export interface City {
  name: string;
  code?: string;
  price?: number;
  etaDays?: number;
}

export interface LGA {
  name: string;
  code?: string;
  price?: number;
  etaDays?: number;
}

export interface State {
  name: string;
  code: string;
  fallbackPrice?: number;
  fallbackEtaDays?: number;
  cities?: City[];
  lgas?: LGA[];
}

export interface LogisticsConfig {
  _id: string;
  countryCode: string;
  countryName: string;
  states: State[];
  createdAt?: string;
  updatedAt?: string;
}

// API Request/Response types
export interface CreateConfigInput {
  countryCode: string;
  countryName: string;
  states: State[];
}

export interface UpdateConfigInput {
  countryCode?: string;
  countryName?: string;
  states?: State[];
}

export interface CreateEmptyCountryInput {
  countryCode: string;
  countryName: string;
}

export interface CountryListItem {
  _id: string;
  countryCode: string;
  countryName: string;
}

export interface QuoteInput {
  productId: string;
  quantity?: number;
  destination: {
    countryName: string;
    stateCode?: string;
    cityName?: string;
    lgaName?: string;
  };
}

export interface QuoteResult {
  currency: string;
  basePrice: number;
  finalPrice: number;
  etaDays: number;
  productShippingAdjustments: {
    addedCost: number;
    increaseCostBy: number;
    addedDays: number;
  };
  breakdown: {
    city?: number;
    lga?: number;
    state?: number;
    productAddedCost?: number;
    productIncreaseCostBy?: number;
  };
}

// Form types for Zod validation
export interface StateFormData {
  name: string;
  code: string;
  fallbackPrice: number;
  fallbackEtaDays: number;
  cities: City[];
  lgas: LGA[];
}

export interface LogisticsFormData {
  countryCode: string;
  countryName: string;
  states: StateFormData[];
}
```

---

### Phase 2: API Hooks with React Query

**Task 2.1: Create Logistics API Client**  
**File**: `apps/isomorphic/src/api/logistics.ts` _(NEW FILE)_

```typescript
import { apiClient } from '@/lib/api-client'; // Adjust path as needed
import type {
  LogisticsConfig,
  CountryListItem,
  CreateConfigInput,
  UpdateConfigInput,
  CreateEmptyCountryInput,
  QuoteInput,
  QuoteResult,
} from '@/types/logistics';

const LOGISTICS_BASE = '/admin/logistics';

export const logisticsApi = {
  // Get all countries (list view)
  getCountries: async (): Promise<CountryListItem[]> => {
    const response = await apiClient.get(`${LOGISTICS_BASE}/countries`);
    return response.data.data;
  },

  // Get single country config by name
  getCountryByName: async (countryName: string): Promise<LogisticsConfig> => {
    const response = await apiClient.get(`${LOGISTICS_BASE}/one/${countryName}`);
    return response.data.data;
  },

  // Create full logistics config
  createConfig: async (data: CreateConfigInput): Promise<LogisticsConfig> => {
    const response = await apiClient.post(`${LOGISTICS_BASE}/config`, data);
    return response.data.data;
  },

  // Update logistics config by ID
  updateConfig: async (id: string, data: UpdateConfigInput): Promise<LogisticsConfig> => {
    const response = await apiClient.patch(`${LOGISTICS_BASE}/config/${id}`, data);
    return response.data.data;
  },

  // Create empty country
  createEmptyCountry: async (data: CreateEmptyCountryInput): Promise<LogisticsConfig> => {
    const response = await apiClient.post(`${LOGISTICS_BASE}/country/add`, data);
    return response.data.data;
  },

  // Delete country by ID
  deleteCountry: async (id: string): Promise<void> => {
    await apiClient.delete(`${LOGISTICS_BASE}/country/${id}`);
  },

  // Get shipping quote (public endpoint)
  getQuote: async (data: QuoteInput): Promise<QuoteResult> => {
    const response = await apiClient.post('/logistics/quote', data);
    return response.data.data;
  },
};
```

**Task 2.2: Create React Query Hooks**  
**File**: `apps/isomorphic/src/hooks/use-logistics.ts` _(NEW FILE)_

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logisticsApi } from '@/api/logistics';
import { toast } from 'sonner'; // Or your toast library
import type { CreateConfigInput, UpdateConfigInput, CreateEmptyCountryInput, QuoteInput } from '@/types/logistics';

// Query keys
export const logisticsKeys = {
  all: ['logistics'] as const,
  countries: () => [...logisticsKeys.all, 'countries'] as const,
  countryByName: (name: string) => [...logisticsKeys.all, 'country', name] as const,
};

// Hook: Get all countries
export function useLogisticsCountries() {
  return useQuery({
    queryKey: logisticsKeys.countries(),
    queryFn: logisticsApi.getCountries,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook: Get country by name
export function useLogisticsCountry(countryName: string, enabled = true) {
  return useQuery({
    queryKey: logisticsKeys.countryByName(countryName),
    queryFn: () => logisticsApi.getCountryByName(countryName),
    enabled: enabled && !!countryName,
  });
}

// Hook: Create full config
export function useCreateLogisticsConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateConfigInput) => logisticsApi.createConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsKeys.countries() });
      toast.success('Logistics configuration created successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create configuration');
    },
  });
}

// Hook: Update config
export function useUpdateLogisticsConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateConfigInput }) => logisticsApi.updateConfig(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: logisticsKeys.countries() });
      if (variables.data.countryName) {
        queryClient.invalidateQueries({
          queryKey: logisticsKeys.countryByName(variables.data.countryName),
        });
      }
      toast.success('Logistics configuration updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update configuration');
    },
  });
}

// Hook: Create empty country
export function useCreateEmptyCountry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEmptyCountryInput) => logisticsApi.createEmptyCountry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsKeys.countries() });
      toast.success('Country created successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create country');
    },
  });
}

// Hook: Delete country
export function useDeleteCountry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => logisticsApi.deleteCountry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logisticsKeys.countries() });
      toast.success('Country deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete country');
    },
  });
}

// Hook: Get shipping quote
export function useShippingQuote() {
  return useMutation({
    mutationFn: (data: QuoteInput) => logisticsApi.getQuote(data),
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to get quote');
    },
  });
}
```

---

### Phase 3: Form Validation Schemas

**Task 3.1: Create Zod Schemas**  
**File**: `apps/isomorphic/src/validators/logistics-schema.ts` _(NEW FILE)_

```typescript
import { z } from 'zod';

// City schema
export const citySchema = z.object({
  name: z.string().min(1, 'City name is required').trim(),
  code: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative').optional(),
  etaDays: z.number().int().min(0, 'ETA days must be non-negative').optional(),
});

// LGA schema
export const lgaSchema = z.object({
  name: z.string().min(1, 'LGA name is required').trim(),
  code: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative').optional(),
  etaDays: z.number().int().min(0, 'ETA days must be non-negative').optional(),
});

// State schema
export const stateSchema = z.object({
  name: z.string().min(1, 'State name is required').trim(),
  code: z.string().min(2, 'State code is required').max(3).trim().toUpperCase(),
  fallbackPrice: z.number().min(0, 'Fallback price must be non-negative').default(0),
  fallbackEtaDays: z.number().int().min(0, 'Fallback ETA must be non-negative').default(0),
  cities: z.array(citySchema).default([]),
  lgas: z.array(lgaSchema).default([]),
});

// Full logistics config schema
export const logisticsConfigSchema = z.object({
  countryCode: z.string().min(2, 'Country code must be 2-3 characters').max(3).trim().toUpperCase(),
  countryName: z.string().min(2, 'Country name is required').trim(),
  states: z.array(stateSchema).default([]),
});

// Empty country schema
export const emptyCountrySchema = z.object({
  countryCode: z.string().min(2, 'Country code must be 2-3 characters').max(3).trim().toUpperCase(),
  countryName: z.string().min(2, 'Country name is required').trim(),
});

// Export inferred types
export type CityFormData = z.infer<typeof citySchema>;
export type LGAFormData = z.infer<typeof lgaSchema>;
export type StateFormData = z.infer<typeof stateSchema>;
export type LogisticsConfigFormData = z.infer<typeof logisticsConfigSchema>;
export type EmptyCountryFormData = z.infer<typeof emptyCountrySchema>;
```

---

### Phase 4: UI Components

**Task 4.1: Countries List Page**  
**File**: `apps/isomorphic/src/app/(hydrogen)/ecommerce/logistics/page.tsx` _(NEW FILE)_

**Features**:

- Table showing all countries with code and name
- Actions: View, Edit, Delete
- "Add Country" button → Modal/drawer to create empty country or full config
- Search/filter by country name or code
- Pagination if needed

**Task 4.2: Country Details/Edit Page**  
**File**: `apps/isomorphic/src/app/(hydrogen)/ecommerce/logistics/[id]/page.tsx` _(NEW FILE)_

**Features**:

- Display country code and name (editable)
- List of states with expand/collapse for cities/LGAs
- Add/Edit/Delete states, cities, LGAs
- Inline editing or modal forms
- Save changes button → calls `useUpdateLogisticsConfig`

**Task 4.3: Create/Edit Forms**  
**File**: `apps/isomorphic/src/app/shared/ecommerce/logistics/logistics-form.tsx` _(NEW FILE)_

**Form Structure**:

```tsx
- Country Code (input, uppercase, 2-3 chars)
- Country Name (input, min 2 chars)
- States (dynamic array)
  - State Name, State Code
  - Fallback Price, Fallback ETA Days
  - Cities (nested dynamic array)
    - City Name, Code, Price, ETA Days
  - LGAs (nested dynamic array)
    - LGA Name, Code, Price, ETA Days
```

**Libraries**:

- `react-hook-form` with `@hookform/resolvers/zod`
- Rizzui components (Input, Button, etc.)
- Dynamic field arrays using `useFieldArray`

**Task 4.4: Reusable Components**

**File**: `apps/isomorphic/src/app/shared/ecommerce/logistics/components/state-fields.tsx` _(NEW FILE)_  
**Purpose**: State form fields with cities/LGAs array management

**File**: `apps/isomorphic/src/app/shared/ecommerce/logistics/components/location-fields.tsx` _(NEW FILE)_  
**Purpose**: Reusable city/LGA fields component

**File**: `apps/isomorphic/src/app/shared/ecommerce/logistics/components/delete-country-modal.tsx` _(NEW FILE)_  
**Purpose**: Confirmation modal for country deletion

---

### Phase 5: Routing & Navigation

**Task 5.1: Update Routes Config**  
**File**: `apps/isomorphic/src/config/routes.ts` _(MODIFY EXISTING)_

Add to `eCommerce` section:

```typescript
eCommerce: {
  // ... existing routes
  logisticsConfig: '/ecommerce/logistics',
  createLogisticsConfig: '/ecommerce/logistics/create',
  logisticsConfigDetails: (id: string) => `/ecommerce/logistics/${id}`,
  editLogisticsConfig: (id: string) => `/ecommerce/logistics/${id}/edit`,
}
```

**Task 5.2: Update Navigation Menu**  
**File**: Check existing navigation config file (likely in `src/layouts` or `src/config`)

Add logistics config link under eCommerce section:

```typescript
{
  name: 'Logistics Configuration',
  href: routes.eCommerce.logisticsConfig,
  icon: <TruckIcon />, // or appropriate icon
}
```

---

### Phase 6: Table Columns & Data Display

**Task 6.1: Create Table Columns**  
**File**: `apps/isomorphic/src/app/shared/ecommerce/logistics/list/columns.tsx` _(NEW FILE)_

**Columns**:

1. Country Code (sortable)
2. Country Name (sortable, searchable)
3. States Count (derived)
4. Actions (View, Edit, Delete)

**Pattern**: Follow existing patterns from `products/list/columns.tsx` or `orders/list/columns.tsx`

**Task 6.2: Create Table Component**  
**File**: `apps/isomorphic/src/app/shared/ecommerce/logistics/list/table.tsx` _(NEW FILE)_

**Features**:

- Use `useTanStackTable` hook
- Integrate with `useLogisticsCountries()` hook
- Row selection for bulk delete (optional)
- Export to CSV functionality

---

## API Reference

### Admin Endpoints (Already Implemented)

#### 1. Get All Countries

```http
GET /admin/logistics/countries
Authorization: Bearer <token>
```

**Response**:

```json
{
  "message": "Countries retrieved successfully",
  "code": 200,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "countryCode": "NG",
      "countryName": "Nigeria"
    }
  ]
}
```

#### 2. Get Country by Name

```http
GET /admin/logistics/one/:country
Authorization: Bearer <token>
```

**Response**:

```json
{
  "message": "Logistics config retrieved successfully",
  "code": 200,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "countryCode": "NG",
    "countryName": "Nigeria",
    "states": [
      {
        "name": "Lagos",
        "code": "LA",
        "fallbackPrice": 1200,
        "fallbackEtaDays": 3,
        "cities": [
          {
            "name": "Ikeja",
            "code": "IKJ",
            "price": 800,
            "etaDays": 1
          }
        ],
        "lgas": [
          {
            "name": "Alimosho",
            "code": "ALM",
            "price": 1000,
            "etaDays": 2
          }
        ]
      }
    ]
  }
}
```

#### 3. Create Full Config

```http
POST /admin/logistics/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "countryCode": "NG",
  "countryName": "Nigeria",
  "states": [
    {
      "name": "Lagos",
      "code": "LA",
      "fallbackPrice": 1200,
      "fallbackEtaDays": 3,
      "cities": [...],
      "lgas": [...]
    }
  ]
}
```

**Response**: Same structure as GET country

#### 4. Update Config

```http
PATCH /admin/logistics/config/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "states": [...]  // Can update countryCode, countryName, or states
}
```

#### 5. Create Empty Country

```http
POST /admin/logistics/country/add
Authorization: Bearer <token>
Content-Type: application/json

{
  "countryCode": "NG",
  "countryName": "Nigeria"
}
```

#### 6. Delete Country

```http
DELETE /admin/logistics/country/:id
Authorization: Bearer <token>
```

**Response**:

```json
{
  "message": "Country deleted successfully",
  "code": 200,
  "data": null
}
```

---

## File Summary

### Backend Files (✅ COMPLETED)

```
src/
├── models/
│   └── LogisticsConfig.ts                    # Mongoose schema
├── services/
│   └── LogisticsService.ts                   # Business logic (10 methods)
├── controller/
│   ├── admin/
│   │   └── LogisticsController.ts            # Admin endpoints (6 methods)
│   └── LogisticsController.ts                # Public endpoints (6 methods)
├── validators/
│   ├── admin/
│   │   └── logistics.ts                      # Admin validators (6 validators)
│   └── logistics.ts                          # Public validators (2 validators)
└── routes/
    ├── admin/
    │   └── logistics.ts                      # Admin routes (6 routes)
    └── general/
        └── logistics.ts                      # Public routes (6 routes)
```

### Frontend Files (🔨 TODO)

```
apps/isomorphic/src/
├── types/
│   └── logistics.ts                          # TypeScript interfaces (NEW)
├── api/
│   └── logistics.ts                          # API client functions (NEW)
├── hooks/
│   └── use-logistics.ts                      # React Query hooks (NEW)
├── validators/
│   └── logistics-schema.ts                   # Zod validation schemas (NEW)
├── app/
│   ├── (hydrogen)/
│   │   └── ecommerce/
│   │       └── logistics/
│   │           ├── page.tsx                  # Countries list page (NEW)
│   │           ├── create/
│   │           │   └── page.tsx              # Create config page (NEW)
│   │           └── [id]/
│   │               ├── page.tsx              # View/Edit country page (NEW)
│   │               └── edit/
│   │                   └── page.tsx          # Edit form page (NEW)
│   └── shared/
│       └── ecommerce/
│           └── logistics/
│               ├── logistics-form.tsx        # Main form component (NEW)
│               ├── list/
│               │   ├── table.tsx             # Countries table (NEW)
│               │   ├── columns.tsx           # Table columns (NEW)
│               │   └── filters.tsx           # Search/filters (NEW)
│               └── components/
│                   ├── state-fields.tsx      # State form fields (NEW)
│                   ├── location-fields.tsx   # City/LGA fields (NEW)
│                   └── delete-modal.tsx      # Delete confirmation (NEW)
└── config/
    └── routes.ts                             # Update with logistics routes (MODIFY)
```

---

## Testing Guidelines

### Backend Testing (Already Working)

**Test Routes**:

```bash
# 1. List countries
GET http://localhost:4000/admin/logistics/countries
Authorization: Bearer <admin_token>

# 2. Create empty country
POST http://localhost:4000/admin/logistics/country/add
{
  "countryCode": "NG",
  "countryName": "Nigeria"
}

# 3. Get country by name
GET http://localhost:4000/admin/logistics/one/Nigeria

# 4. Create full config
POST http://localhost:4000/admin/logistics/config
{
  "countryCode": "GH",
  "countryName": "Ghana",
  "states": [
    {
      "name": "Greater Accra",
      "code": "GA",
      "fallbackPrice": 1500,
      "fallbackEtaDays": 4,
      "cities": [],
      "lgas": []
    }
  ]
}

# 5. Update config (use _id from create response)
PATCH http://localhost:4000/admin/logistics/config/<mongo_id>
{
  "states": [...]
}

# 6. Delete country
DELETE http://localhost:4000/admin/logistics/country/<mongo_id>
```

### Frontend Testing Checklist

**Unit Tests** (Optional but recommended):

- [ ] Logistics type definitions compile correctly
- [ ] Zod schemas validate correctly
- [ ] API client functions call correct endpoints

**Integration Tests**:

- [ ] Create empty country → appears in list
- [ ] Create full config → all states/cities/LGAs saved
- [ ] Edit country → changes persist
- [ ] Delete country → removed from list
- [ ] Form validation → shows correct errors
- [ ] Table pagination → works correctly
- [ ] Search/filter → filters countries

**Manual Testing Flow**:

1. Navigate to `/ecommerce/logistics`
2. Click "Add Country" → Create "Nigeria" with empty states
3. Click "Edit" → Add state "Lagos" with fallback price 1200
4. Add city "Ikeja" to Lagos with price 800
5. Add LGA "Alimosho" to Lagos with price 1000
6. Save and verify data persists
7. Test delete functionality
8. Test search and filters

---

## Implementation Priority

### Phase 1: Core Setup (Week 1)

1. ✅ Create TypeScript types (`logistics.ts`)
2. ✅ Create API client (`api/logistics.ts`)
3. ✅ Create React Query hooks (`use-logistics.ts`)
4. ✅ Create Zod schemas (`logistics-schema.ts`)

### Phase 2: UI Components (Week 1-2)

5. ✅ Create countries list page and table
6. ✅ Create country details/edit page
7. ✅ Create logistics form with nested arrays
8. ✅ Create reusable components (state fields, location fields)

### Phase 3: Integration (Week 2)

9. ✅ Add routes to config
10. ✅ Add navigation menu items
11. ✅ Test CRUD operations
12. ✅ Add error handling and loading states

### Phase 4: Polish (Week 2-3)

13. ✅ Add toast notifications
14. ✅ Add confirmation modals
15. ✅ Improve UX (loading spinners, disabled states)
16. ✅ Add export to CSV functionality
17. ✅ Test edge cases (duplicate country codes, etc.)

---

## Long-term Goals

### Future Enhancements

1. **Bulk Import**: CSV upload for mass location data
2. **Currency Support**: Multi-currency pricing
3. **Analytics**: Track most expensive/cheapest locations
4. **Shipping Rules**: Conditional pricing (e.g., free shipping over X amount)
5. **API Rate Limiting**: Protect logistics endpoints from abuse
6. **Audit Logs**: Track who changed what in logistics configs
7. **Versioning**: Keep history of price changes

### Integration with Cart

- Use `calculateProgressiveShipping` in cart checkout flow
- Display shipping breakdown to users
- Allow users to see price differences by location
- Cache shipping calculations for performance

---

## Notes

- **Backend is 100% complete** - No backend changes needed
- **Focus on frontend** - All implementation is UI/UX work
- **Follow existing patterns** - Reference products, orders, or returns pages
- **Use React Query** - All data fetching should use hooks
- **Zod validation** - Form validation using Zod schemas
- **Rizzui components** - Maintain design consistency
- **TypeScript strict** - All types must be properly defined

---

## Support

For questions or issues:

1. Review existing backend code in `src/services/LogisticsService.ts`
2. Test endpoints using Postman/Thunder Client
3. Check frontend patterns in existing ecommerce pages
4. Reference returns implementation for similar CRUD patterns

**Good luck with the implementation! 🚀**
