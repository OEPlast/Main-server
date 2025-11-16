import { Types } from 'mongoose';
import { CartType } from '@/models/Cart';
import ProductModel from '@/models/Product';
import SalesModel from '@/models/Sales';
import CouponModel from '@/models/Coupon';
import { CustomResponseType } from '@/types';

// Abstract types derived from existing schema definitions
export type CartItemType = CartType['items'][0];
export type FrontendCartItemType = {
  _id?: string;
  product: string;
  qty: number;
  selectedAttributes?: Array<{ name: string; value: string }>;
  unitPrice: number;
  totalPrice: number;
  sale?: string;
  saleVariantIndex?: number;
  appliedDiscount: number;
  discountAmount: number;
  pricingTier?: PricingTierType;
};
// Removed unused schema alias types to satisfy lint rules

// Pricing calculation types - using proper type definitions
interface PricingTierType {
  minQty: number;
  maxQty?: number;
  strategy: 'fixedPrice' | 'percentOff' | 'amountOff';
  value: number;
}

interface AttributeType {
  name: string;
  children: Array<{
    name: string;
    price?: number;
    discount?: number;
    stock: number;
    image: string;
  }>;
}

interface SalesVariantType {
  attributeName?: string;
  attributeValue?: string;
  discount: number;
  amountOff: number;
  maxBuys: number;
  boughtCount: number;
}

// Validation result types
interface ItemPriceValidation {
  itemId: string;
  valid: boolean;
  frontendPrice: number;
  backendPrice: number;
  discrepancy?: number;
  details: {
    basePrice: number;
    attributeAdjustments: number;
    pricingTierDiscount: number;
    salesDiscount: number;
    finalUnitPrice: number;
  };
}

interface CouponValidation {
  valid: boolean;
  frontendDiscount: number;
  backendDiscount: number;
  discrepancy?: number;
  details: {
    couponCode?: string;
    discountType?: 'percentage' | 'fixed';
    appliesTo?: 'order' | 'product' | 'category';
    maxDiscount?: number;
    minOrderValue?: number;
  };
}

interface CartValidationResult {
  valid: boolean;
  totalDiscrepancy: number;
  frontendTotal: number;
  backendTotal: number;
  itemValidations: ItemPriceValidation[];
  couponValidation: CouponValidation | null;
  shippingValidation: {
    valid: boolean;
    frontendCost: number;
    backendCost: number;
    discrepancy?: number;
  };
}

// Types for frontend cart validation/correction
export type FrontendCartItemInput = {
  _id?: string;
  product: string;
  qty: number;
  selectedAttributes?: Array<{ name: string; value: string }>;
  unitPrice: number;
  totalPrice: number;
  sale?: string;
  appliedDiscount?: number;
  discountAmount?: number;
  productSnapshot?: {
    name: string;
    price: number;
    sku: number;
  };
};

export type FrontendCartData = {
  items: FrontendCartItemInput[];
  couponCodes: string[];
  subtotal: number;
  total: number;
  totalDiscount: number;
  estimatedShipping: { cost: number; days: number };
};

export type ValidatedCoupon = {
  code: string;
  couponId: Types.ObjectId;
  discountAmount: number;
  discountType: 'percentage' | 'fixed';
};

export type RejectedCoupon = {
  code: string;
  reason: string;
};

export type CorrectedCart = FrontendCartData & {
  items: Array<FrontendCartItemInput & { unitPrice: number; totalPrice: number }>;
  validatedCoupons: ValidatedCoupon[];
  rejectedCoupons: RejectedCoupon[];
  couponDiscount: number;
  status: 'active';
  lastActivity: string;
  updatedAt: string;
};

export type CartChangeDetail = {
  field: string;
  previous: number | string | null;
  current: number | string | null;
  message: string;
  context?: 'item' | 'coupon' | 'subtotal' | 'total' | 'shipping' | 'other';
  reference?: string;
};

export type ValidateAndCorrectCartResult = {
  needsUpdate: boolean;
  correctedCart: CorrectedCart;
  changes: string[];
  changeDetails: CartChangeDetail[];
  checkoutErrors?: {
    products?: Array<{
      productId: string;
      productName: string;
      productSlug: string;
      cartItemId: string;
      issueType: 'outOfStock' | 'quantityReduced' | 'priceChanged' | 'attributeUnavailable' | 'saleExpired';
      message: string;
      severity: 'critical' | 'warning' | 'info';
      currentQty: number;
      availableStock: number;
      currentPrice: number | null;
      correctedPrice: number | null;
      unavailableAttributes: Array<{ name: string; value: string }> | null;
      availableAttributes: Array<Array<{ name: string; value: string }>> | null;
      suggestedAction: 'remove' | 'reduceQuantity' | 'changeAttribute' | 'acceptPrice';
      saleInfo?: {
        previousSaleId: string;
        previousDiscount: number;
        expiryReason: 'endDateReached' | 'maxBuysReached' | 'deactivated';
      };
    }>;
    coupons?: Array<{
      code: string;
      reason: string;
      previousDiscount: number;
      expiryDate?: string;
    }>;
    shipping?: {
      previousCost: number;
      currentCost: number;
      reason: string;
      destination?: {
        state: string;
        city?: string;
      };
    };
    total?: {
      expectedTotal: number;
      calculatedTotal: number;
      discrepancy: number;
      message: string;
    };
  };
};

// Individual calculation functions using arrow functions
export const calculateAttributeAdjustments = (
  selectedAttributes: Array<{ name: string; value: string }> | undefined,
  productAttributes: AttributeType[] | undefined
): number => {
  if (!selectedAttributes?.length || !productAttributes?.length) return 0;

  return selectedAttributes.reduce((total, selected) => {
    const matchingAttribute = productAttributes.find((attr) => attr.name === selected.name);
    if (!matchingAttribute) return total;

    const matchingChild = matchingAttribute.children.find((child) => child.name === selected.value);
    if (!matchingChild) return total;

    const attributePrice = matchingChild.price || 0;
    const attributeDiscount = matchingChild.discount || 0;

    return total + (attributePrice - attributeDiscount);
  }, 0);
};

const calculatePricingTierDiscount = (
  quantity: number,
  basePrice: number,
  pricingTiers: PricingTierType[] | undefined
): number => {
  if (!pricingTiers?.length) return 0;

  // Sort tiers by minQty descending to find the best applicable tier
  const sortedTiers = [...pricingTiers].sort((a, b) => b.minQty - a.minQty);

  const applicableTier = sortedTiers.find((tier) => {
    const minValid = quantity >= tier.minQty;
    const maxValid = !tier.maxQty || quantity <= tier.maxQty;
    return minValid && maxValid;
  });

  if (!applicableTier) return 0;

  switch (applicableTier.strategy) {
    case 'fixedPrice':
      // For fixedPrice, the discount is the difference between base price and fixed price
      return Math.max(0, basePrice - applicableTier.value);
    case 'percentOff':
      return (basePrice * applicableTier.value) / 100;
    case 'amountOff':
      return Math.min(applicableTier.value, basePrice);
    default:
      return 0;
  }
};

const calculateSalesDiscount = (
  basePrice: number,
  quantity: number,
  selectedAttributes: Array<{ name: string; value: string }> | undefined,
  salesData:
    | { variants?: SalesVariantType[] | null; isActive?: boolean; startDate?: Date; endDate?: Date }
    | null
    | undefined
): number => {
  if (!salesData?.variants || salesData.variants.length === 0 || !salesData.isActive) return 0;

  // Check date range if provided
  if (salesData.startDate && salesData.endDate) {
    const now = new Date();
    const start = new Date(salesData.startDate);
    const end = new Date(salesData.endDate);
    if (now < start || now > end) return 0;
  }

  // Helper to check if value is null or 'all'/'All'
  const isAllOrNull = (value: string | null | undefined): boolean => {
    return value === null || value === undefined || value === 'all' || value === 'All';
  };

  // Find matching variant based on client sale matching rules
  let matchingVariant: SalesVariantType | undefined;

  for (const variant of salesData.variants) {
    const attrName = variant.attributeName;
    const attrValue = variant.attributeValue;

    // Rule 1: attributeName is null or 'all'/'All' → applies to all products/variants
    if (isAllOrNull(attrName)) {
      matchingVariant = variant;
      break;
    }

    // Rule 2: attributeName exists BUT attributeValue is null or 'all'/'All' → applies to all values of that attribute
    if (attrName && isAllOrNull(attrValue)) {
      const hasAttribute = selectedAttributes?.some((attr) => attr.name === attrName);
      if (hasAttribute || !selectedAttributes || selectedAttributes.length === 0) {
        matchingVariant = variant;
        break;
      }
    }

    // Rule 3: Both attributeName AND attributeValue specified → exact match required
    if (attrName && attrValue && !isAllOrNull(attrValue) && selectedAttributes) {
      const exactMatch = selectedAttributes.some((attr) => attr.name === attrName && attr.value === attrValue);
      if (exactMatch) {
        matchingVariant = variant;
        break;
      }
    }
  }

  if (!matchingVariant) return 0;

  // MAXBUYS LIMIT CHECK: If sale type is 'Limited', verify qty doesn't exceed remaining stock
  const maxBuys = matchingVariant.maxBuys || 0;
  const boughtCount = matchingVariant.boughtCount || 0;
  const remainingStock = maxBuys - boughtCount;

  // Only apply sale if quantity doesn't exceed remaining stock (maxBuys = 0 means unlimited)
  if (maxBuys > 0 && quantity > remainingStock) {
    return 0; // Quantity exceeds sale limit, no sale applied
  }

  // Handle both percentage discount and fixed amount off
  if (matchingVariant.amountOff > 0) {
    return Math.min(matchingVariant.amountOff, basePrice);
  } else if (matchingVariant.discount > 0) {
    return (basePrice * matchingVariant.discount) / 100;
  }

  return 0;
};

// Helper to stringify potential ObjectId or string values
const toIdString = (val: unknown): string | undefined => {
  if (typeof val === 'string') return val;
  if (val && typeof (val as { toString?: unknown }).toString === 'function') {
    return (val as { toString(): string }).toString();
  }
  return undefined;
};

export const validateItemPrice = async (
  item: FrontendCartItemType | FrontendCartItemInput | CartItemType,
  frontendPrice: number
): Promise<ItemPriceValidation> => {
  try {
    // Fetch product with pricing data
    const product = await ProductModel.findById(item.product)
      .select('price attributes pricingTiers')
      .lean<{ price?: number; attributes?: AttributeType[]; pricingTiers?: PricingTierType[] }>();

    if (!product) {
      return {
        itemId: toIdString((item as { _id?: unknown })._id) || '',
        valid: false,
        frontendPrice,
        backendPrice: 0,
        discrepancy: frontendPrice,
        details: {
          basePrice: 0,
          attributeAdjustments: 0,
          pricingTierDiscount: 0,
          salesDiscount: 0,
          finalUnitPrice: 0,
        },
      };
    }

    // Calculate base price with adjustments
    const basePrice = product.price || 0;
    const attributeAdjustments = calculateAttributeAdjustments(item.selectedAttributes, product.attributes);

    const adjustedBasePrice = basePrice + attributeAdjustments;

    // Apply discounts sequentially (tier first, then sale)
    let currentPrice = adjustedBasePrice;

    // Calculate and apply pricing tier discount first
    const pricingTierDiscount = calculatePricingTierDiscount(item.qty, currentPrice, product.pricingTiers);
    currentPrice = currentPrice - pricingTierDiscount;

    // Then calculate and apply sale discount on top of tier price
    let salesDiscount = 0;
    if (item.sale) {
      const salesData = await SalesModel.findById(item.sale).lean<{
        variants?: SalesVariantType[];
        isActive?: boolean;
        startDate?: Date;
        endDate?: Date;
      }>();
      // Apply sale discount to price AFTER tier discount (not base price)
      salesDiscount = calculateSalesDiscount(currentPrice, item.qty, item.selectedAttributes, salesData);
    }
    currentPrice = currentPrice - salesDiscount;

    // Calculate final unit price
    const finalUnitPrice = Math.max(0, currentPrice);

    const backendPrice = finalUnitPrice;
    const discrepancy = Math.abs(frontendPrice - backendPrice);
    const valid = discrepancy < 0.01; // Allow 1 cent tolerance for floating point

    return {
      itemId: toIdString((item as { _id?: unknown })._id) || toIdString((item as { product?: unknown }).product) || '',
      valid,
      frontendPrice,
      backendPrice,
      discrepancy: valid ? undefined : discrepancy,
      details: {
        basePrice,
        attributeAdjustments,
        pricingTierDiscount,
        salesDiscount,
        finalUnitPrice,
      },
    };
  } catch (error) {
    console.error('Error validating item price:', error);
    return {
      itemId: toIdString((item as { _id?: unknown })._id) || toIdString((item as { product?: unknown }).product) || '',
      valid: false,
      frontendPrice,
      backendPrice: 0,
      discrepancy: frontendPrice,
      details: {
        basePrice: 0,
        attributeAdjustments: 0,
        pricingTierDiscount: 0,
        salesDiscount: 0,
        finalUnitPrice: 0,
      },
    };
  }
};

export const validateCouponDiscount = async (
  cart: CartType,
  frontendCouponDiscount: number
): Promise<CouponValidation> => {
  try {
    // Check if any coupons are applied in the cart
    if (!cart.appliedCoupons?.length || frontendCouponDiscount === 0) {
      return {
        valid: frontendCouponDiscount === 0,
        frontendDiscount: frontendCouponDiscount,
        backendDiscount: 0,
        discrepancy: frontendCouponDiscount > 0 ? frontendCouponDiscount : undefined,
        details: {},
      };
    }

    // For simplicity, we'll validate the first applied coupon
    // In a real implementation, you might want to validate all coupons
    const appliedCoupon = cart.appliedCoupons[0];
    const coupon = await CouponModel.findById(appliedCoupon.coupon).lean();
    if (!coupon) {
      return {
        valid: false,
        frontendDiscount: frontendCouponDiscount,
        backendDiscount: 0,
        discrepancy: frontendCouponDiscount,
        details: {},
      };
    }

    // Check if coupon is still valid (date range)
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      return {
        valid: false,
        frontendDiscount: frontendCouponDiscount,
        backendDiscount: 0,
        discrepancy: frontendCouponDiscount,
        details: {
          couponCode: coupon.coupon,
        },
      };
    }

    // Calculate cart subtotal for coupon application
    let cartSubtotal = 0;
    const applicableItems: CartItemType[] = [];

    for (const item of cart.items) {
      const itemValidation = await validateItemPrice(item, 0); // We just need backend price
      const itemTotal = itemValidation.backendPrice * item.qty;

      // Check if item is applicable based on coupon scope
      if (coupon.appliesTo.scope === 'order') {
        applicableItems.push(item);
        cartSubtotal += itemTotal;
      } else if (coupon.appliesTo.scope === 'product') {
        const productIdMatch = coupon.appliesTo.productIds?.some((id) => id.toString() === item.product.toString());
        if (productIdMatch) {
          applicableItems.push(item);
          cartSubtotal += itemTotal;
        }
      }
      // TODO: Add category-based validation if needed
    }

    // Check minimum order value
    if (coupon.minOrderValue && cartSubtotal < coupon.minOrderValue) {
      return {
        valid: false,
        frontendDiscount: frontendCouponDiscount,
        backendDiscount: 0,
        discrepancy: frontendCouponDiscount,
        details: {
          couponCode: coupon.coupon,
          minOrderValue: coupon.minOrderValue,
        },
      };
    }

    // Calculate backend discount
    let backendDiscount = 0;
    if (coupon.discountType === 'percentage') {
      backendDiscount = (cartSubtotal * coupon.discount) / 100;
    } else if (coupon.discountType === 'fixed') {
      backendDiscount = Math.min(coupon.discount, cartSubtotal);
    }

    // Apply max discount limit if specified (note: maxDiscount field doesn't exist in current schema)
    // if (coupon.maxDiscount && backendDiscount > coupon.maxDiscount) {
    //   backendDiscount = coupon.maxDiscount;
    // }

    const discrepancy = Math.abs(frontendCouponDiscount - backendDiscount);
    const valid = discrepancy < 0.01;

    return {
      valid,
      frontendDiscount: frontendCouponDiscount,
      backendDiscount,
      discrepancy: valid ? undefined : discrepancy,
      details: {
        couponCode: coupon.coupon,
        discountType: coupon.discountType,
        appliesTo: coupon.appliesTo.scope,
        maxDiscount: undefined, // Field doesn't exist in current coupon schema
        minOrderValue: coupon.minOrderValue,
      },
    };
  } catch (error) {
    console.error('Error validating coupon discount:', error);
    return {
      valid: false,
      frontendDiscount: frontendCouponDiscount,
      backendDiscount: 0,
      discrepancy: frontendCouponDiscount,
      details: {},
    };
  }
};

// Main validation service functions
export const validateCartPricing = async (
  cart: CartType,
  frontendTotal: number,
  frontendCouponDiscount: number = 0,
  frontendShippingCost: number = 0
): Promise<CustomResponseType<CartValidationResult>> => {
  try {
    // Validate each item's pricing
    const itemValidations: ItemPriceValidation[] = [];
    let backendSubtotal = 0;

    for (const item of cart.items) {
      // Calculate frontend unit price (using unitPrice from cart item)
      const frontendUnitPrice = item.unitPrice || 0;
      const itemValidation = await validateItemPrice(item, frontendUnitPrice);
      itemValidations.push(itemValidation);

      backendSubtotal += itemValidation.backendPrice * item.qty;
    }

    // Validate coupon discount
    const couponValidation = await validateCouponDiscount(cart, frontendCouponDiscount);

    // Calculate backend total
    const backendTotal = backendSubtotal - couponValidation.backendDiscount + frontendShippingCost;

    // Calculate overall validation result
    const totalDiscrepancy = Math.abs(frontendTotal - backendTotal);
    const itemsValid = itemValidations.every((item) => item.valid);
    const couponValid = couponValidation.valid;
    const overallValid = itemsValid && couponValid && totalDiscrepancy < 0.01;

    const result: CartValidationResult = {
      valid: overallValid,
      totalDiscrepancy,
      frontendTotal,
      backendTotal,
      itemValidations,
      couponValidation,
      shippingValidation: {
        valid: true, // Assuming shipping is calculated by backend
        frontendCost: frontendShippingCost,
        backendCost: frontendShippingCost,
      },
    };

    return {
      message: overallValid ? 'Cart pricing validated successfully' : 'Cart pricing discrepancies detected',
      data: result,
      code: overallValid ? 200 : 400,
    };
  } catch (error) {
    console.error('Error validating cart pricing:', error);
    return {
      message: 'Failed to validate cart pricing',
      data: null,
      code: 500,
    };
  }
};

export const recalculateCartTotals = async (
  cart: CartType
): Promise<
  CustomResponseType<{
    subtotal: number;
    couponDiscount: number;
    total: number;
    itemBreakdown: ItemPriceValidation[];
  }>
> => {
  try {
    // Recalculate each item
    const itemBreakdown: ItemPriceValidation[] = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const itemValidation = await validateItemPrice(item, 0);
      itemBreakdown.push(itemValidation);
      subtotal += itemValidation.backendPrice * item.qty;
    }

    // Recalculate coupon discount
    const couponValidation = await validateCouponDiscount(cart, 0);
    const couponDiscount = couponValidation.backendDiscount;

    // Calculate final total (shipping will be added separately by LogisticsService)
    const total = subtotal - couponDiscount;

    return {
      message: 'Cart totals recalculated successfully',
      data: {
        subtotal,
        couponDiscount,
        total,
        itemBreakdown,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error recalculating cart totals:', error);
    return {
      message: 'Failed to recalculate cart totals',
      data: null,
      code: 500,
    };
  }
};

// Helper function to detect product-level issues
type ProductIssueType = {
  productId: string;
  productName: string;
  productSlug: string;
  cartItemId: string;
  issueType: 'outOfStock' | 'quantityReduced' | 'priceChanged' | 'attributeUnavailable' | 'saleExpired';
  message: string;
  severity: 'critical' | 'warning' | 'info';
  currentQty: number;
  availableStock: number;
  currentPrice: number | null;
  correctedPrice: number | null;
  unavailableAttributes: Array<{ name: string; value: string }> | null;
  availableAttributes: Array<Array<{ name: string; value: string }>> | null;
  suggestedAction: 'remove' | 'reduceQuantity' | 'changeAttribute' | 'acceptPrice';
  saleInfo?: {
    previousSaleId: string;
    previousDiscount: number;
    expiryReason: 'endDateReached' | 'maxBuysReached' | 'deactivated';
  };
};

const detectProductIssues = async (
  item: FrontendCartItemInput,
  itemValidation: ItemPriceValidation
): Promise<ProductIssueType | null> => {
  try {
    const product = await ProductModel.findById(item.product)
      .select('name slug stock attributes')
      .lean<{ name?: string; slug?: string; stock?: number; attributes?: AttributeType[] }>();

    if (!product) return null;

    const cartItemId = item._id || item.product;
    const productId = item.product;
    const productName = product.name || 'Product';
    const productSlug = product.slug || '';

    // Check 1: Out of stock
    if (product.stock === 0) {
      return {
        productId,
        productName,
        productSlug,
        cartItemId,
        issueType: 'outOfStock',
        message: 'This product is currently out of stock',
        severity: 'critical',
        currentQty: item.qty,
        availableStock: 0,
        currentPrice: null,
        correctedPrice: null,
        unavailableAttributes: null,
        availableAttributes: null,
        suggestedAction: 'remove',
      };
    }

    // Check 2: Quantity reduced (requested more than available)
    const productStock = product.stock ?? 0;
    if (item.qty > productStock) {
      return {
        productId,
        productName,
        productSlug,
        cartItemId,
        issueType: 'quantityReduced',
        message: `Only ${productStock} unit${productStock !== 1 ? 's' : ''} available (you requested ${item.qty})`,
        severity: 'warning',
        currentQty: item.qty,
        availableStock: productStock,
        currentPrice: itemValidation.frontendPrice,
        correctedPrice: itemValidation.backendPrice,
        unavailableAttributes: null,
        availableAttributes: null,
        suggestedAction: 'reduceQuantity',
      };
    }

    // Check 3: Attribute unavailable (check if selected attributes are in stock)
    if (item.selectedAttributes && item.selectedAttributes.length > 0 && product.attributes) {
      for (const selectedAttr of item.selectedAttributes) {
        const matchingAttribute = product.attributes.find((attr) => attr.name === selectedAttr.name);
        if (matchingAttribute) {
          const matchingChild = matchingAttribute.children.find((child) => child.name === selectedAttr.value);
          if (matchingChild && matchingChild.stock === 0) {
            // This attribute variant is out of stock - find available alternatives
            const availableChildren = matchingAttribute.children.filter((child) => child.stock > 0);
            const availableAttributes: Array<Array<{ name: string; value: string }>> = availableChildren.map(
              (child) => [{ name: matchingAttribute.name, value: child.name }]
            );

            return {
              productId,
              productName,
              productSlug,
              cartItemId,
              issueType: 'attributeUnavailable',
              message: `Selected variant (${selectedAttr.name}: ${selectedAttr.value}) is no longer available`,
              severity: 'warning',
              currentQty: item.qty,
              availableStock: productStock,
              currentPrice: itemValidation.frontendPrice,
              correctedPrice: itemValidation.backendPrice,
              unavailableAttributes: [selectedAttr],
              availableAttributes: availableAttributes.length > 0 ? availableAttributes : null,
              suggestedAction: availableAttributes.length > 0 ? 'changeAttribute' : 'remove',
            };
          }
        }
      }
    }

    // Check 4: Price changed (including sale expiry)
    if (!itemValidation.valid) {
      const priceIncreased = itemValidation.backendPrice > itemValidation.frontendPrice;

      // Check if this was due to sale expiry
      if (item.sale) {
        const salesData = await SalesModel.findById(item.sale).lean<{
          isActive?: boolean;
          startDate?: Date;
          endDate?: Date;
        }>();

        let saleExpired = false;
        let expiryReason: 'endDateReached' | 'maxBuysReached' | 'deactivated' = 'deactivated';

        if (salesData) {
          if (!salesData.isActive) {
            saleExpired = true;
            expiryReason = 'deactivated';
          } else if (salesData.endDate && new Date() > new Date(salesData.endDate)) {
            saleExpired = true;
            expiryReason = 'endDateReached';
          }
        } else {
          saleExpired = true; // Sale doesn't exist anymore
        }

        if (saleExpired && priceIncreased) {
          return {
            productId,
            productName,
            productSlug,
            cartItemId,
            issueType: 'saleExpired',
            message: `Sale ended - price increased from ₦${itemValidation.frontendPrice.toLocaleString()} to ₦${itemValidation.backendPrice.toLocaleString()}`,
            severity: 'info',
            currentQty: item.qty,
            availableStock: productStock,
            currentPrice: itemValidation.frontendPrice,
            correctedPrice: itemValidation.backendPrice,
            unavailableAttributes: null,
            availableAttributes: null,
            suggestedAction: 'acceptPrice',
            saleInfo: {
              previousSaleId: item.sale,
              previousDiscount: Math.round(
                ((itemValidation.backendPrice - itemValidation.frontendPrice) / itemValidation.backendPrice) * 100
              ),
              expiryReason,
            },
          };
        }
      }

      // Regular price change (not sale related)
      return {
        productId,
        productName,
        productSlug,
        cartItemId,
        issueType: 'priceChanged',
        message: `Price ${
          priceIncreased ? 'increased' : 'decreased'
        }: ₦${itemValidation.frontendPrice.toLocaleString()} → ₦${itemValidation.backendPrice.toLocaleString()}`,
        severity: 'info',
        currentQty: item.qty,
        availableStock: productStock,
        currentPrice: itemValidation.frontendPrice,
        correctedPrice: itemValidation.backendPrice,
        unavailableAttributes: null,
        availableAttributes: null,
        suggestedAction: 'acceptPrice',
      };
    }

    return null; // No issues detected
  } catch (error) {
    console.error('Error detecting product issues:', error);
    return null;
  }
};

// Simplified validation function that returns either success or corrected cart
export const validateAndCorrectCart = async (
  frontendCartData: FrontendCartData,
  couponCodes?: string[] // Changed from appliedCoupons to couponCodes
): Promise<CustomResponseType<ValidateAndCorrectCartResult>> => {
  try {
    // Validate each item's pricing
    let backendSubtotal = 0;
    const correctedItems: Array<FrontendCartItemInput & { unitPrice: number; totalPrice: number }> = [];
    const changes: string[] = [];
    const changeDetails: CartChangeDetail[] = [];
    const productIssues: ProductIssueType[] = [];
    let needsUpdate = false;

    for (const item of frontendCartData.items) {
      const itemValidation = await validateItemPrice(item, item.unitPrice);

      // Detect product-level issues
      const productIssue = await detectProductIssues(item, itemValidation);
      if (productIssue) {
        productIssues.push(productIssue);
      }

      // Update item with backend prices
      const correctedItem = {
        ...item,
        unitPrice: itemValidation.backendPrice,
        totalPrice: itemValidation.backendPrice * item.qty,
      };

      correctedItems.push(correctedItem);
      backendSubtotal += itemValidation.backendPrice * item.qty;

      // Check if item price changed
      if (!itemValidation.valid) {
        needsUpdate = true;
        const oldTotal = item.totalPrice;
        const newTotal = correctedItem.totalPrice;
        const message = `Item "${
          item.productSnapshot?.name || item.product
        }" price updated: ₦${oldTotal.toLocaleString()} → ₦${newTotal.toLocaleString()}`;
        changes.push(message);
        changeDetails.push({
          field: 'itemPrice',
          previous: oldTotal,
          current: newTotal,
          message,
          context: 'item',
          reference: item.productSnapshot?.sku?.toString() || item.product,
        });
      }
    }

    // Validate and process coupon codes (if provided)
    let backendCouponDiscount = 0;
    const validatedCoupons: ValidatedCoupon[] = [];
    const rejectedCoupons: RejectedCoupon[] = [];
    const couponIssues: Array<{
      code: string;
      reason: string;
      previousDiscount: number;
      expiryDate?: string;
    }> = [];

    if (couponCodes?.length) {
      // Validate each coupon code against active coupons in database
      for (const code of couponCodes) {
        try {
          const coupon = await CouponModel.findOne({
            coupon: code.toUpperCase(),
            active: true,
            deleted: { $ne: true },
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
          }).lean();

          if (!coupon) {
            rejectedCoupons.push({ code, reason: 'Coupon not found or expired' });
            couponIssues.push({
              code,
              reason: 'Coupon not found or expired',
              previousDiscount: 0,
            });
            continue;
          }

          // Check minimum order value
          if (coupon.minOrderValue && backendSubtotal < coupon.minOrderValue) {
            const reason = `Minimum order value of ₦${coupon.minOrderValue.toLocaleString()} required`;
            rejectedCoupons.push({ code, reason });
            couponIssues.push({
              code,
              reason,
              previousDiscount: 0,
            });
            continue;
          }

          // Calculate discount for this coupon
          let couponDiscountAmount = 0;
          if (coupon.discountType === 'percentage') {
            couponDiscountAmount = (backendSubtotal * coupon.discount) / 100;
          } else if (coupon.discountType === 'fixed') {
            couponDiscountAmount = Math.min(coupon.discount, backendSubtotal);
          }

          if (couponDiscountAmount > 0) {
            validatedCoupons.push({
              code,
              couponId: coupon._id as Types.ObjectId,
              discountAmount: couponDiscountAmount,
              discountType: coupon.discountType,
            });
            backendCouponDiscount += couponDiscountAmount;
          } else {
            rejectedCoupons.push({ code, reason: 'No discount applicable' });
            couponIssues.push({
              code,
              reason: 'No discount applicable',
              previousDiscount: 0,
            });
          }
        } catch (error) {
          console.error(`Error validating coupon ${code}:`, error);
          rejectedCoupons.push({ code, reason: 'Error validating coupon' });
          couponIssues.push({
            code,
            reason: 'Error validating coupon',
            previousDiscount: 0,
          });
        }
      }
    }

    // Calculate corrected totals
    const correctedSubtotal = backendSubtotal;
    const correctedTotal = backendSubtotal - backendCouponDiscount;
    const totalDiscount = backendCouponDiscount;

    // Check if totals changed or if coupons were rejected
    if (Math.abs(frontendCartData.subtotal - correctedSubtotal) > 0.01) {
      needsUpdate = true;
      const message = `Subtotal updated: ₦${frontendCartData.subtotal.toLocaleString()} → ₦${correctedSubtotal.toLocaleString()}`;
      changes.push(message);
      changeDetails.push({
        field: 'subtotal',
        previous: frontendCartData.subtotal,
        current: correctedSubtotal,
        message,
        context: 'subtotal',
      });
    }

    if (Math.abs(frontendCartData.total - correctedTotal) > 0.01) {
      needsUpdate = true;
      const message = `Total updated: ₦${frontendCartData.total.toLocaleString()} → ₦${correctedTotal.toLocaleString()}`;
      changes.push(message);
      changeDetails.push({
        field: 'total',
        previous: frontendCartData.total,
        current: correctedTotal,
        message,
        context: 'total',
      });
    }

    // Add coupon changes to the list
    if (validatedCoupons.length > 0) {
      const message = `Applied coupons: ${validatedCoupons.map((c) => c.code).join(', ')}`;
      changes.push(message);
      changeDetails.push({
        field: 'coupon',
        previous: null,
        current: validatedCoupons.map((c) => c.code).join(', '),
        message,
        context: 'coupon',
      });
    }
    if (rejectedCoupons.length > 0) {
      const message = `Rejected coupons: ${rejectedCoupons.map((c) => `${c.code} (${c.reason})`).join(', ')}`;
      changes.push(message);
      changeDetails.push({
        field: 'coupon',
        previous: rejectedCoupons.map((c) => c.code).join(', '),
        current: null,
        message,
        context: 'coupon',
      });
      needsUpdate = true; // Force update if any coupons were rejected
    }

    // Mark as needing update if there are any product issues
    if (productIssues.length > 0) {
      needsUpdate = true;
    }

    // Build structured checkout errors
    const checkoutErrors: ValidateAndCorrectCartResult['checkoutErrors'] = {};

    if (productIssues.length > 0) {
      checkoutErrors.products = productIssues;
    }

    if (couponIssues.length > 0) {
      checkoutErrors.coupons = couponIssues;
    }

    const result: ValidateAndCorrectCartResult = {
      needsUpdate,
      correctedCart: {
        ...frontendCartData,
        items: correctedItems,
        validatedCoupons, // Replace appliedCoupons with validatedCoupons
        rejectedCoupons, // Include rejected coupons info
        subtotal: correctedSubtotal,
        total: correctedTotal,
        totalDiscount,
        couponDiscount: backendCouponDiscount,
        estimatedShipping: frontendCartData.estimatedShipping || { cost: 0, days: 0 },
        status: 'active',
        lastActivity: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      changes,
      changeDetails,
      checkoutErrors: Object.keys(checkoutErrors).length > 0 ? checkoutErrors : undefined,
    };

    return {
      message: needsUpdate ? 'Price discrepancies detected' : 'Cart pricing is valid',
      data: result,
      code: needsUpdate ? 400 : 200,
    };
  } catch (error) {
    console.error('Error validating and correcting cart:', error);
    return {
      message: 'Failed to validate cart',
      data: null,
      code: 500,
    };
  }
};
