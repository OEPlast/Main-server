export type LogisticsCity = {
  name: string;
  code?: string;
  price?: number; // override price to destination
  etaDays?: number; // override ETA days
};

export type LogisticsLGA = {
  name: string;
  code?: string;
  price?: number;
  etaDays?: number;
};

export type LogisticsState = {
  name: string;
  code: string; // e.g., CA, NY, LA, etc.
  fallbackPrice?: number;
  fallbackEtaDays?: number;
  cities?: LogisticsCity[];
  lgas?: LogisticsLGA[];
};

export type LogisticsConfig = {
  _id?: string;
  countryCode: string; // ISO alpha-2 or alpha-3
  countryName: string;
  states: LogisticsState[];
  createdAt?: string;
  updatedAt?: string;
};

export type QuoteInput = {
  productId: string;
  quantity?: number;
  destination: {
    countryCode: string;
    stateCode?: string;
    cityName?: string;
    lgaName?: string;
  };
};

export type QuoteResult = {
  currency: string;
  basePrice: number; // derived from logistics table
  productShippingAdjustments: {
    addedCost: number;
    increaseCostBy: number;
    addedDays: number;
  };
  finalPrice: number;
  etaDays: number;
  breakdown: {
    country?: number;
    state?: number;
    city?: number;
    lga?: number;
    productAddedCost?: number;
    productIncreaseCostBy?: number;
  };
};

// Public-facing location tree without prices/ETAs
export type LocationTree = Array<{
  countryCode: string;
  countryName: string;
  states: Array<{
    name: string;
    code: string;
    cities: Array<{ name: string; code?: string }>;
    lgas: Array<{ name: string; code?: string }>;
  }>;
}>;
