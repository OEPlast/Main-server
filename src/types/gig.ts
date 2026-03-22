// GIG Logistics API Types

// ============================================
// Enums & Constants
// ============================================

export const GIG_VEHICLE_TYPE = {
  Car: 0,
  Bike: 1,
  Van: 2,
  Truck: 3,
} as const;
export type GIGVehicleType = (typeof GIG_VEHICLE_TYPE)[keyof typeof GIG_VEHICLE_TYPE];

export const GIG_CUSTOMER_TYPE = {
  Company: 0,
  IndividualCustomer: 1,
  Partner: 2,
} as const;
export type GIGCustomerType = (typeof GIG_CUSTOMER_TYPE)[keyof typeof GIG_CUSTOMER_TYPE];

export const GIG_PICKUP_OPTION = {
  HomeDelivery: 0,
  ServiceCentre: 1,
} as const;
export type GIGPickupOption = (typeof GIG_PICKUP_OPTION)[keyof typeof GIG_PICKUP_OPTION];

export const GIG_SHIPMENT_TYPE = {
  Special: 0,
  Regular: 1,
  Ecommerce: 2,
  Store: 3,
  Haulage: 4,
} as const;
export type GIGShipmentType = (typeof GIG_SHIPMENT_TYPE)[keyof typeof GIG_SHIPMENT_TYPE];

export const CHECKOUT_DELIVERY_METHOD = {
  Shipping: 'shipping',
  Pickup: 'pickup',
  Gig: 'gig',
} as const;

export type CheckoutDeliveryMethod = (typeof CHECKOUT_DELIVERY_METHOD)[keyof typeof CHECKOUT_DELIVERY_METHOD];

// ============================================
// Shared Response Wrapper (all endpoints)
// ============================================

// All GIG endpoints use the V3 response wrapper: { success, data: { message, apiId, status, data } }
export interface GIGV3DataWrapper<T> {
  message: string;
  apiId: string;
  status: number;
  data: T;
}

export type GIGV3APIResponse<J> = GIGV3DataWrapper<J>;

// ============================================
// /price — Fetch Shipment Price
// ============================================

export interface GIGPriceLocation {
  Latitude: number;
  Longitude: number;
}

export interface GIGPriceShipmentItem {
  ItemName?: string;
  Description?: string;
  Quantity: number;
  ShipmentType: GIGShipmentType;
  Weight?: number;
  IsVolumetric?: boolean;
  Value?: number;
  SpecialPackageId?: number;
  Length?: number;
  Width?: number;
  Height?: number;
}

export interface GIGPriceRequest {
  SenderStationId: number;
  ReceiverStationId: number;
  VehicleType: GIGVehicleType;
  ReceiverLocation: GIGPriceLocation;
  SenderLocation: GIGPriceLocation;
  CustomerCode: string;
  CustomerType: GIGCustomerType;
  PickUpOptions: GIGPickupOption;
  ShipmentItems: GIGPriceShipmentItem[];
  IsFromAgility?: boolean;
  DeliveryOptionIds?: number[];
  Value?: number;
}

export interface GIGPriceResultItem {
  ItemName: string;
  Description: string;
  Quantity: number;
  Weight: number;
  IsVolumetric: boolean;
  ShipmentType: number;
  Value: number;
  CalculatedPrice: number;
}

export interface GIGPriceResult {
  isWithinProcessingTime: boolean;
  MainCharge: number;
  DeliverPrice: number;
  PickupCharge: number;
  InsuranceValue: number;
  GrandTotal: number;
  DeclaredValue: number;
  Discount: number;
  ShipmentItems: GIGPriceResultItem[];
}

// ============================================
// /capture/preshipment — Create Shipment
// ============================================

export interface GIGPreshipmentLocation {
  Latitude: string;
  Longitude: string;
  FormattedAddress?: string;
  Name?: string;
  LGA?: string;
}

export interface GIGPreshipmentSenderDetails {
  SenderName: string;
  SenderPhoneNumber: string;
  SenderStationId: number;
  SenderAddress: string;
  InputtedSenderAddress: string;
  SenderLocality: string;
  SenderLocation: GIGPreshipmentLocation;
}

export interface GIGPreshipmentReceiverDetails {
  ReceiverStationId: number;
  ReceiverName: string;
  ReceiverPhoneNumber: string;
  ReceiverAddress: string;
  InputtedReceiverAddress: string;
  ReceiverLocation: GIGPreshipmentLocation;
  DestinationServiceCenterId?: number;
}

export interface GIGPreshipmentShipmentDetails {
  VehicleType: GIGVehicleType;
  IsPriorityShipment?: boolean;
  PricingStrategy?: number;
  IsFromAgility?: number;
  IsBatchPickUp?: number;
}

export interface GIGPreshipmentShipmentItem {
  ItemName?: string;
  Description?: string;
  Quantity: number;
  ShipmentType: GIGShipmentType;
  Weight?: number;
  IsVolumetric?: boolean;
  Value?: number;
  SpecialPackageId?: number;
  Length?: number;
  Width?: number;
  Height?: number;
  HaulageId?: number;
}

export interface GIGPreshipmentRequest {
  SenderDetails?: GIGPreshipmentSenderDetails;
  ReceiverDetails?: GIGPreshipmentReceiverDetails;
  ShipmentDetails?: GIGPreshipmentShipmentDetails;
  ShipmentItems: GIGPreshipmentShipmentItem[];
  fetchOption?: number | '';
}

export interface GIGPreshipmentResult {
  Waybill: string;
}

export interface GIGStation {
  _id?: string;
  StationId: number;
  StationName: string;
  StationCode: string;
  StateId?: number;
  StateName: string;
  IsDeleted?: boolean;
  SuperServiceCentreId?: number;
  StationPickupPrice?: number;
  IsPublic?: boolean;
  DateCreated?: string;
  DateModified?: string;
  CountryName?: string;
  CountryId?: number;
  CountryCode?: string;
  CurrencyCode?: string;
  CurrencySymbol?: string;
  GiggoActive?: boolean;
}

// ============================================
// /get/preshipment — Track Shipment by Waybill
// ============================================

export interface GIGPreshipmentMobileDetails {
  PreShipmentMobileId: number;
  Waybill: string;
  SenderName: string;
  SenderPhoneNumber: string;
  ReceiverName: string;
  ReceiverPhoneNumber: string;
  ReceiverAddress: string;
  SenderAddress: string;
  SenderStationId: number;
  ReceiverStationId: number;
  IsHomeDelivery: boolean;
  GrandTotal: number;
  DeliveryPrice: number;
  VehicleType: string;
  shipmentstatus: string;
  IsCancelled: boolean;
  IsDelivered: boolean;
  DateCreated: string;
  DateModified: string;
  WaybillImageUrl?: string;
}

// ============================================
// Internal Types (used in our app)
// ============================================

/**
 * What the client sends to the calculate-shipping endpoint.
 * The backend resolves product dimensions and pricing from the DB.
 */
export interface GIGShippingCartItem {
  productId: string;
  quantity: number;
  selectedAttributes?: { name: string; value: string }[];
}

export interface GIGShippingRequest {
  items: GIGShippingCartItem[];
  receiverAddress: string;
  receiverState: string;
  receiverCity?: string;
  receiverLatitude?: number;
  receiverLongitude?: number;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverCountryCode?: string;
}

export interface GIGCalculateShippingInput {
  items: Array<{
    name: string;
    quantity: number;
    weight: number;
    height: number;
    width: number;
    length: number;
    isVolumetric: boolean;
    value: number;
    imageUrl?: string;
  }>;
  receiverAddress: string;
  receiverState: string;
  receiverCity?: string;
  receiverLatitude?: number;
  receiverLongitude?: number;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverCountryCode?: string;
}

export interface GIGCalculateShippingResult {
  shippingCost: number;
  currency: string;
  deliveryDiscountApplied?: number;
  estimatedDelivery?: {
    minDays: number;
    maxDays: number;
    label: string;
  };
  breakdown?: {
    deliverPrice: number;
    pickupCharge: number;
    insuranceValue: number;
    mainCharge: number;
    grandTotal: number;
    discount: number;
  };
}

export interface GIGPublicCheckoutConfig {
  enabledDeliveryMethods: CheckoutDeliveryMethod[];
  shippingDiscountAmountOff: number;
  gigDiscountAmountOff: number;
  freeShippingThreshold: number | null;
  shippingWindow: {
    minDays: number;
    maxDays: number;
    label: string;
  };
}
