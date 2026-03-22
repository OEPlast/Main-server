import GIGConfig, { GIGConfigType } from '@/models/GIGConfig';
import {
  CHECKOUT_DELIVERY_METHOD,
  CheckoutDeliveryMethod,
  GIGPriceRequest,
  GIGPreshipmentRequest,
  GIG_VEHICLE_TYPE,
  GIG_CUSTOMER_TYPE,
  GIG_PICKUP_OPTION,
  GIG_SHIPMENT_TYPE,
  GIGShipmentType,
  GIGVehicleType,
  GIGCustomerType,
  GIGPickupOption,
  GIGV3APIResponse,
  GIGPriceResult,
  GIGPreshipmentResult,
  GIGPreshipmentMobileDetails,
  GIGStation,
  GIGCalculateShippingInput,
  GIGCalculateShippingResult,
  GIGPublicCheckoutConfig,
} from '@/types/gig';

const GIG_API_URL = process.env.GIG_API_URL || 'https://dev-thirdpartynode.theagilitysystems.com';
const GIG_ACCESS_TOKEN = process.env.GIG_ACCESS_TOKEN || '';

// Maps admin config string values to GIG API numeric enum values
const VEHICLE_TYPE_MAP: Record<string, GIGVehicleType> = {
  BIKE: GIG_VEHICLE_TYPE.Bike,
  VAN: GIG_VEHICLE_TYPE.Van,
  TRUCK: GIG_VEHICLE_TYPE.Truck,
  CAR: GIG_VEHICLE_TYPE.Car,
};

const CUSTOMER_TYPE_MAP: Record<string, GIGCustomerType> = {
  Company: GIG_CUSTOMER_TYPE.Company,
  IndividualCustomer: GIG_CUSTOMER_TYPE.IndividualCustomer,
  Partner: GIG_CUSTOMER_TYPE.Partner,
};

const PICKUP_OPTION_MAP: Record<string, GIGPickupOption> = {
  HomeDelivery: GIG_PICKUP_OPTION.HomeDelivery,
  ServiceCentre: GIG_PICKUP_OPTION.ServiceCentre,
  '0': GIG_PICKUP_OPTION.HomeDelivery,
  '1': GIG_PICKUP_OPTION.ServiceCentre,
};

const VOLUMETRIC_DIMENSIONS_THRESHOLD = 500;
const DEFAULT_DELIVERY_METHODS: CheckoutDeliveryMethod[] = [
  CHECKOUT_DELIVERY_METHOD.Shipping,
  CHECKOUT_DELIVERY_METHOD.Pickup,
  CHECKOUT_DELIVERY_METHOD.Gig,
];
const DEFAULT_SHIPPING_MIN_DAYS = 2;
const DEFAULT_SHIPPING_MAX_DAYS = 5;
const DEFAULT_SHIPPING_DISCOUNT_AMOUNT_OFF = 0;
const DEFAULT_GIG_DISCOUNT_AMOUNT_OFF = 0;
const DEFAULT_FREE_SHIPPING_THRESHOLD: number | null = null;
const MAX_DELIVERY_DISCOUNT_PERCENT = 100;

type ResolvedDeliverySettings = {
  enabledDeliveryMethods: CheckoutDeliveryMethod[];
  shippingDiscountAmountOff: number;
  gigDiscountAmountOff: number;
  freeShippingThreshold: number | null;
  shippingMinDeliveryDays: number;
  shippingMaxDeliveryDays: number;
};

const DELIVERY_METHOD_SET = new Set<CheckoutDeliveryMethod>(DEFAULT_DELIVERY_METHODS);

const normalizeEnabledDeliveryMethods = (methods?: string[] | null): CheckoutDeliveryMethod[] => {
  if (!Array.isArray(methods) || methods.length === 0) {
    return DEFAULT_DELIVERY_METHODS;
  }

  const normalized = methods
    .filter((method): method is CheckoutDeliveryMethod => DELIVERY_METHOD_SET.has(method as CheckoutDeliveryMethod))
    .filter((method, index, all) => all.indexOf(method) === index);

  return normalized.length > 0 ? normalized : DEFAULT_DELIVERY_METHODS;
};

const resolveShippingWindow = (minDays?: number, maxDays?: number) => {
  const min = Number.isFinite(minDays) ? Math.max(0, Number(minDays)) : DEFAULT_SHIPPING_MIN_DAYS;
  const maxSource = Number.isFinite(maxDays) ? Number(maxDays) : DEFAULT_SHIPPING_MAX_DAYS;
  const max = Math.max(min, Math.max(0, maxSource));

  return {
    minDays: min,
    maxDays: max,
    label: `${min} - ${max} days`,
  };
};

const resolveDeliverySettings = (config?: GIGConfigType | null): ResolvedDeliverySettings => {
  const shippingWindow = resolveShippingWindow(config?.shippingMinDeliveryDays, config?.shippingMaxDeliveryDays);
  const rawFreeShippingThreshold =
    Number.isFinite(config?.freeShippingThreshold) && Number(config?.freeShippingThreshold) >= 0
      ? Number(config?.freeShippingThreshold)
      : DEFAULT_FREE_SHIPPING_THRESHOLD;

  return {
    enabledDeliveryMethods: normalizeEnabledDeliveryMethods(config?.enabledDeliveryMethods),
    shippingDiscountAmountOff: Math.min(
      MAX_DELIVERY_DISCOUNT_PERCENT,
      Math.max(
        0,
        Number.isFinite(config?.shippingDiscountAmountOff)
          ? Number(config?.shippingDiscountAmountOff)
          : DEFAULT_SHIPPING_DISCOUNT_AMOUNT_OFF
      )
    ),
    gigDiscountAmountOff: Math.min(
      MAX_DELIVERY_DISCOUNT_PERCENT,
      Math.max(
        0,
        Number.isFinite(config?.gigDiscountAmountOff)
          ? Number(config?.gigDiscountAmountOff)
          : DEFAULT_GIG_DISCOUNT_AMOUNT_OFF
      )
    ),
    freeShippingThreshold: rawFreeShippingThreshold,
    shippingMinDeliveryDays: shippingWindow.minDays,
    shippingMaxDeliveryDays: shippingWindow.maxDays,
  };
};

const applyDeliveryDiscount = (amount: number, discountPercent: number) => {
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;
  const normalizedDiscountPercent = Math.min(
    MAX_DELIVERY_DISCOUNT_PERCENT,
    Math.max(0, Number.isFinite(discountPercent) ? discountPercent : 0)
  );
  const finalAmount = Math.max(0, normalizedAmount - (normalizedAmount * normalizedDiscountPercent) / 100);

  return {
    finalAmount: Math.round(finalAmount * 100) / 100,
    appliedDiscount: Math.round((normalizedAmount - finalAmount) * 100) / 100,
  };
};

const applyDeliveryDiscountByMethod = (
  amount: number,
  method: CheckoutDeliveryMethod,
  settings: Pick<ResolvedDeliverySettings, 'shippingDiscountAmountOff' | 'gigDiscountAmountOff'>
) => {
  if (method === CHECKOUT_DELIVERY_METHOD.Pickup) {
    return {
      finalAmount: amount,
      appliedDiscount: 0,
    };
  }

  const discountAmountOff =
    method === CHECKOUT_DELIVERY_METHOD.Gig ? settings.gigDiscountAmountOff : settings.shippingDiscountAmountOff;

  return applyDeliveryDiscount(amount, discountAmountOff);
};

const normalizeShipmentItemForGig = (
  item: GIGCalculateShippingInput['items'][number],
  shipmentType: GIGShipmentType
) => {
  const normalizedQuantity = item.quantity > 0 ? item.quantity : 1;
  const volume = item.length * item.width * item.height;
  const shouldIncludeDimensions = item.isVolumetric && volume >= VOLUMETRIC_DIMENSIONS_THRESHOLD;

  return {
    ItemName: item.name,
    Description: item.name,
    // GIG expects each entry to be a single shipment line with aggregated weight.
    Quantity: 1,
    Weight: item.weight * normalizedQuantity,
    IsVolumetric: item.isVolumetric,
    ShipmentType: shipmentType,
    Value: item.value,
    Length: shouldIncludeDimensions ? item.length : 0,
    Width: shouldIncludeDimensions ? item.width : 0,
    Height: shouldIncludeDimensions ? item.height : 0,
  };
};

// ============================================
// Low-level GIG API Methods
// ============================================

/**
 * All GIG endpoints use the V3 response wrapper: { success, data: { message, apiId, status, data } }
 */
async function gigFetchV3<T>(path: string, options: RequestInit = {}): Promise<GIGV3APIResponse<T>> {
  const url = `${GIG_API_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access-token': GIG_ACCESS_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`GIG API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as GIGV3APIResponse<T>;

  if (data.status !== 200) {
    throw new Error(`GIG API returned error: ${data.message || 'Unknown error'}`);
  }

  return data;
}

/**
 * Get all GIG stations
 */
async function getStations(): Promise<{ message: string; data: GIGStation[] | null; code: number }> {
  try {
    const result = await gigFetchV3<GIGStation[]>('/localstations/get');
    return { message: 'Stations retrieved successfully', data: result.data, code: 200 };
  } catch (error) {
    console.error('GIG getStations error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to fetch GIG stations';
    return { message: errMsg, data: null, code: 503 };
  }
}

/**
 * Calculate shipping price via GIG API
 */
async function calculatePrice(
  payload: GIGPriceRequest
): Promise<{ message: string; data: GIGPriceResult | null; code: number }> {
  try {
    const result = await gigFetchV3<GIGPriceResult>('/price', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log(result.data);
    return { message: 'Price calculated successfully', data: result.data, code: 200 };
  } catch (error) {
    console.error('GIG calculatePrice error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to calculate GIG shipping price';
    return { message: errMsg, data: null, code: 503 };
  }
}

/**
 * Create a GIG preshipment (capture)
 */
async function createPreshipment(
  payload: GIGPreshipmentRequest
): Promise<{ message: string; data: GIGPreshipmentResult | null; code: number }> {
  try {
    const result = await gigFetchV3<GIGPreshipmentResult>('/capture/preshipment', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { message: 'Preshipment created successfully', data: result.data, code: 200 };
  } catch (error) {
    console.error('GIG createPreshipment error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to create GIG preshipment';
    return { message: errMsg, data: null, code: 503 };
  }
}

/**
 * Track a GIG shipment by waybill number
 */
async function trackShipment(
  waybill: string
): Promise<{ message: string; data: GIGPreshipmentMobileDetails[] | null; code: number }> {
  try {
    const result = await gigFetchV3<GIGPreshipmentMobileDetails[]>(
      `/get/preshipment?Waybill=${encodeURIComponent(waybill)}`
    );
    return { message: 'Tracking info retrieved successfully', data: result.data, code: 200 };
  } catch (error) {
    console.error('GIG trackShipment error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to track GIG shipment';
    return { message: errMsg, data: null, code: 503 };
  }
}

// ============================================
// Config Management
// ============================================

/**
 * Get the singleton GIG configuration (or null if not configured)
 */
async function getConfig(): Promise<{ message: string; data: GIGConfigType | null; code: number }> {
  try {
    const config = await GIGConfig.findOne().lean<GIGConfigType>();

    if (!config) {
      return { message: 'GIG configuration not found', data: null, code: 404 };
    }
    return { message: 'GIG configuration retrieved', data: config, code: 200 };
  } catch (error) {
    console.error('GIG getConfig error:', error);
    return { message: 'Failed to retrieve GIG configuration', data: null, code: 500 };
  }
}

async function getPublicCheckoutConfig(): Promise<{ message: string; data: GIGPublicCheckoutConfig; code: number }> {
  const configResult = await getConfig();
  const settings = resolveDeliverySettings(configResult.data);
  const shippingWindow = resolveShippingWindow(settings.shippingMinDeliveryDays, settings.shippingMaxDeliveryDays);

  return {
    message: 'Checkout delivery settings retrieved',
    data: {
      enabledDeliveryMethods: settings.enabledDeliveryMethods,
      shippingDiscountAmountOff: settings.shippingDiscountAmountOff,
      gigDiscountAmountOff: settings.gigDiscountAmountOff,
      freeShippingThreshold: settings.freeShippingThreshold,
      shippingWindow,
    },
    code: 200,
  };
}

async function isDeliveryMethodEnabled(method: CheckoutDeliveryMethod): Promise<boolean> {
  const configResult = await getConfig();
  const settings = resolveDeliverySettings(configResult.data);
  return settings.enabledDeliveryMethods.includes(method);
}

/**
 * Upsert the GIG configuration (singleton)
 */
async function upsertConfig(
  data: Partial<GIGConfigType>
): Promise<{ message: string; data: GIGConfigType | null; code: number }> {
  try {
    const config = await GIGConfig.findOneAndUpdate(
      {},
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    ).lean<GIGConfigType>();

    return { message: 'GIG configuration updated', data: config, code: 200 };
  } catch (error) {
    console.error('GIG upsertConfig error:', error);
    return { message: 'Failed to update GIG configuration', data: null, code: 500 };
  }
}

// ============================================
// Helper: Find station by state name
// ============================================

/**
 * Find the GIG station ID for a given state name
 */
async function getStationIdForState(stateName: string): Promise<number | null> {
  const stationsResult = await getStations();
  if (!stationsResult.data) return null;

  const normalized = stateName.trim().toLowerCase();
  const station = stationsResult.data.find(
    (s) => s.StateName?.toLowerCase() === normalized || s.StationName?.toLowerCase() === normalized
  );

  return station?.StationId ?? null;
}

// ============================================
// High-level: Calculate Shipping for Cart
// ============================================

/**
 * Calculate GIG shipping cost for a cart.
 * Loads sender config from DB, resolves receiver station, calls GIG price API.
 */
async function calculateShipping(
  input: GIGCalculateShippingInput
): Promise<{ message: string; data: GIGCalculateShippingResult | null; code: number }> {
  // Load GIG config
  const configResult = await getConfig();
  if (!configResult.data) {
    return { message: 'GIG shipping is not configured', data: null, code: 503 };
  }

  const config = configResult.data;
  if (!config.isActive) {
    return { message: 'GIG shipping is currently disabled', data: null, code: 503 };
  }

  const deliverySettings = resolveDeliverySettings(config);
  if (!deliverySettings.enabledDeliveryMethods.includes(CHECKOUT_DELIVERY_METHOD.Gig)) {
    return { message: 'GIG delivery is currently unavailable', data: null, code: 400 };
  }

  // Resolve receiver station
  const receiverStationId = await getStationIdForState(input.receiverState);
  if (!receiverStationId) {
    return {
      message: `GIG shipping is not available for ${input.receiverState}`,
      data: null,
      code: 400,
    };
  }

  const vehicleType = VEHICLE_TYPE_MAP[config.vehicleType?.toUpperCase() ?? ''] ?? GIG_VEHICLE_TYPE.Bike;
  const customerType = CUSTOMER_TYPE_MAP[config.customerType ?? ''] ?? GIG_CUSTOMER_TYPE.Company;
  const pickupOption = PICKUP_OPTION_MAP[config.defaultPickUpOptions ?? ''] ?? GIG_PICKUP_OPTION.HomeDelivery;

  const pricePayload: GIGPriceRequest = {
    SenderStationId: config.senderStationId,
    ReceiverStationId: receiverStationId,
    VehicleType: vehicleType,
    SenderLocation: {
      Latitude: config.senderLatitude,
      Longitude: config.senderLongitude,
    },
    ReceiverLocation: {
      Latitude: input.receiverLatitude ?? 0,
      Longitude: input.receiverLongitude ?? 0,
    },
    CustomerCode: config.customerCode,
    CustomerType: customerType,
    PickUpOptions: pickupOption,
    ShipmentItems: input.items.map((item) => normalizeShipmentItemForGig(item, GIG_SHIPMENT_TYPE.Regular)),
  };
  console.log(pricePayload);

  const priceResult = await calculatePrice(pricePayload);
  if (!priceResult.data) {
    return { message: priceResult.message, data: null, code: priceResult.code };
  }

  const discountedDelivery = applyDeliveryDiscount(priceResult.data.GrandTotal, deliverySettings.gigDiscountAmountOff);

  return {
    message: 'GIG shipping cost calculated',
    data: {
      shippingCost: discountedDelivery.finalAmount,
      currency: 'NGN',
      deliveryDiscountApplied: discountedDelivery.appliedDiscount,
      estimatedDelivery: resolveShippingWindow(
        deliverySettings.shippingMinDeliveryDays,
        deliverySettings.shippingMaxDeliveryDays
      ),
      breakdown: {
        deliverPrice: priceResult.data.DeliverPrice,
        pickupCharge: priceResult.data.PickupCharge,
        insuranceValue: priceResult.data.InsuranceValue,
        mainCharge: priceResult.data.MainCharge,
        grandTotal: priceResult.data.GrandTotal,
        discount: priceResult.data.Discount,
      },
    },
    code: 200,
  };
}

// ============================================
// High-level: Create GIG Shipment for Order
// ============================================

/**
 * Create a GIG preshipment for a paid order.
 * Returns waybill number on success.
 */
async function createShipmentForOrder(
  input: GIGCalculateShippingInput & {
    receiverEmail?: string;
  }
): Promise<{ message: string; data: { waybillNumber: string } | null; code: number }> {
  const configResult = await getConfig();
  if (!configResult.data) {
    return { message: 'GIG shipping is not configured', data: null, code: 503 };
  }

  const config = configResult.data;

  const deliverySettings = resolveDeliverySettings(config);
  if (!deliverySettings.enabledDeliveryMethods.includes(CHECKOUT_DELIVERY_METHOD.Gig)) {
    return { message: 'GIG delivery is currently unavailable', data: null, code: 400 };
  }

  const receiverStationId = await getStationIdForState(input.receiverState);
  if (!receiverStationId) {
    return { message: `No GIG station found for ${input.receiverState}`, data: null, code: 400 };
  }

  const vehicleType = VEHICLE_TYPE_MAP[config.vehicleType?.toUpperCase() ?? ''] ?? GIG_VEHICLE_TYPE.Bike;

  const preshipmentPayload: GIGPreshipmentRequest = {
    SenderDetails: {
      SenderName: config.senderName,
      SenderPhoneNumber: config.senderPhoneNumber,
      SenderStationId: config.senderStationId,
      SenderAddress: config.senderAddress,
      InputtedSenderAddress: config.senderAddress,
      SenderLocality: config.senderLocality,
      SenderLocation: {
        Latitude: String(config.senderLatitude),
        Longitude: String(config.senderLongitude),
        FormattedAddress: '',
        Name: '',
        LGA: '',
      },
    },
    ReceiverDetails: {
      ReceiverStationId: receiverStationId,
      ReceiverName: input.receiverName,
      ReceiverPhoneNumber: input.receiverPhoneNumber,
      ReceiverAddress: input.receiverAddress,
      InputtedReceiverAddress: input.receiverAddress,
      ReceiverLocation: {
        Latitude: String(input.receiverLatitude ?? 0),
        Longitude: String(input.receiverLongitude ?? 0),
        FormattedAddress: '',
        Name: '',
        LGA: '',
      },
    },
    ShipmentDetails: {
      VehicleType: vehicleType,
      IsFromAgility: 0,
      IsBatchPickUp: 0,
    },
    ShipmentItems: input.items.map((item) => normalizeShipmentItemForGig(item, GIG_SHIPMENT_TYPE.Ecommerce)),
  };

  const result = await createPreshipment(preshipmentPayload);
  if (!result.data) {
    return { message: result.message, data: null, code: result.code };
  }

  return {
    message: 'GIG shipment created',
    data: { waybillNumber: result.data.Waybill },
    code: 200,
  };
}

const GIGService = {
  getStations,
  calculatePrice,
  createPreshipment,
  trackShipment,
  getConfig,
  getPublicCheckoutConfig,
  isDeliveryMethodEnabled,
  applyDeliveryDiscount,
  applyDeliveryDiscountByMethod,
  upsertConfig,
  getStationIdForState,
  calculateShipping,
  createShipmentForOrder,
};

export default GIGService;
