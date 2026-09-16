import { Types } from 'mongoose';
import { CartType } from '@/models/Cart';
import ProductModel from '@/models/Product';
import SalesModel, { SalesType } from '@/models/Sales';
import { validateCouponCodes } from '@/helpers/couponUtils';
import { priceCart, roundKobo, toCouponLines, type PricedCartLine } from '@/services/pricing';
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

/**
 * Builds the price check for one line from the shared pricing module (`services/pricing`), the
 * same formula order creation charges with. `line` is null when the product no longer exists.
 */
const toItemValidation = (
  item: FrontendCartItemInput,
  frontendPrice: number,
  line: PricedCartLine | null
): ItemPriceValidation => {
  const itemId = toIdString((item as { _id?: unknown })._id) || toIdString(item.product) || '';
  if (!line) {
    return {
      itemId,
      valid: false,
      frontendPrice,
      backendPrice: 0,
      discrepancy: frontendPrice,
      details: { basePrice: 0, attributeAdjustments: 0, pricingTierDiscount: 0, salesDiscount: 0, finalUnitPrice: 0 },
    };
  }
  const discrepancy = Math.abs(frontendPrice - line.unitPrice);
  const valid = discrepancy < 0.01;
  return {
    itemId,
    valid,
    frontendPrice,
    backendPrice: line.unitPrice,
    discrepancy: valid ? undefined : discrepancy,
    details: {
      basePrice: line.listUnitPrice,
      attributeAdjustments: 0,
      pricingTierDiscount: roundKobo(line.listUnitPrice - line.tierUnitPrice),
      salesDiscount: line.sale?.unitDiscount ?? 0,
      finalUnitPrice: line.unitPrice,
    },
  };
};

// Helper to stringify potential ObjectId or string values
const toIdString = (val: unknown): string | undefined => {
  if (typeof val === 'string') return val;
  if (val && typeof (val as { toString?: unknown }).toString === 'function') {
    return (val as { toString(): string }).toString();
  }
  return undefined;
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
          type: SalesType['type'];
        }>();

        let saleExpired = false;
        let expiryReason: 'endDateReached' | 'maxBuysReached' | 'deactivated' = 'deactivated';

        if (salesData) {
          if (!salesData.isActive) {
            saleExpired = true;
            expiryReason = 'deactivated';
          } else if (salesData.type === 'Flash' && salesData.endDate && new Date() > new Date(salesData.endDate)) {
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
  couponCodes?: string[],
  /** The shopper, so once-per-customer coupon rules are checked the same way order creation checks them. */
  userId?: string
): Promise<CustomResponseType<ValidateAndCorrectCartResult>> => {
  try {
    // Validate each item's pricing
    let backendSubtotal = 0;
    const correctedItems: Array<FrontendCartItemInput & { unitPrice: number; totalPrice: number }> = [];
    const changes: string[] = [];
    const changeDetails: CartChangeDetail[] = [];
    const productIssues: ProductIssueType[] = [];
    let needsUpdate = false;

    const priced = await priceCart(
      frontendCartData.items.map((item) => ({
        product: item.product,
        qty: item.qty,
        selectedAttributes: item.selectedAttributes,
      }))
    );
    const lineByIndex: Array<PricedCartLine | null> = [];
    {
      let cursor = 0;
      const missing = new Set(priced.missingProductIds);
      for (const item of frontendCartData.items) {
        lineByIndex.push(missing.has(String(item.product)) ? null : (priced.lines[cursor++] ?? null));
      }
    }

    for (const [index, item] of frontendCartData.items.entries()) {
      const line = lineByIndex[index] ?? null;
      const itemValidation = toItemValidation(item, item.unitPrice, line);

      // Detect product-level issues
      const productIssue = await detectProductIssues(item, itemValidation);
      if (productIssue) {
        productIssues.push(productIssue);
      }

      // Update item with backend prices. The sale fields come from the server's pricing, never
      // from the request.
      const correctedItem = {
        ...item,
        unitPrice: itemValidation.backendPrice,
        totalPrice: line?.lineTotal ?? 0,
        sale: line?.sale?.saleId,
        saleVariantIndex: line?.sale?.variantIndex,
        appliedDiscount: line && line.listUnitPrice > 0 ? roundKobo(((line.listUnitPrice - line.unitPrice) / line.listUnitPrice) * 100) : 0,
        discountAmount: line ? roundKobo(line.tierDiscountTotal + line.saleDiscountTotal) : 0,
      };

      correctedItems.push(correctedItem);
      backendSubtotal = roundKobo(backendSubtotal + correctedItem.totalPrice);

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

    // Coupons: same eligibility checks and discount formula as order creation.
    const validatedCoupons: ValidatedCoupon[] = [];
    const rejectedCoupons: RejectedCoupon[] = [];
    const couponIssues: Array<{
      code: string;
      reason: string;
      previousDiscount: number;
      expiryDate?: string;
    }> = [];

    let backendCouponDiscount = 0;
    if (couponCodes?.length) {
      const couponResult = await validateCouponCodes({
        couponCodes,
        lines: toCouponLines(priced.lines),
        userId: userId ?? null,
      });
      backendCouponDiscount = couponResult.totalDiscount;
      for (const valid of couponResult.validCoupons) {
        validatedCoupons.push({
          code: valid.code,
          couponId: valid.couponDoc._id,
          discountAmount: valid.discount,
          discountType: (valid.couponDoc.discountType || 'percentage') as ValidatedCoupon['discountType'],
        });
      }
      for (const invalid of couponResult.invalidCoupons) {
        rejectedCoupons.push({ code: invalid.code, reason: invalid.reason });
        couponIssues.push({ code: invalid.code, reason: invalid.reason, previousDiscount: 0 });
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
