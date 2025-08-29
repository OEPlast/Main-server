import Cart, { CartType } from '@/models/Cart';
import Product, { ProductType } from '@/models/Product';
import Coupon, { CouponType } from '@/models/Coupon';
import { CustomResponseType } from '@/types';
import { checkSaleAvailability } from '@/helpers/salesUtils';
import {
  ProductPricingShape,
  VariantOption,
  resolveBestVariant,
  applyPricingTier,
  PricingTier,
} from '@/helpers/pricingUtils';
import mongoose from 'mongoose';

// Define changed entry types to avoid any
type ChangedSaleInfo = {
  sale?: mongoose.Types.ObjectId;
  saleVariantIndex?: number;
  appliedDiscount?: number;
  discountAmount?: number;
};

type ChangedEntry = {
  itemId: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  old: ChangedSaleInfo;
  current: ChangedSaleInfo;
};

// Use multi-attribute resolver
const resolveVariant = resolveBestVariant;

// Applied tier shape (selected tier + the price it yielded)
type AppliedPricingTier = PricingTier & { appliedPrice: number };

// Pricing helpers
function calculateItemPricing({
  product,
  variant,
  qty,
  saleContext,
}: {
  product: ProductPricingShape;
  variant?: VariantOption;
  qty: number;
  saleContext?: { discount?: number; amountOff?: number };
}): {
  unitPrice: number;
  totalPrice: number;
  appliedDiscount: number;
  discountAmount: number;
  pricingTier?: AppliedPricingTier;
} {
  // 1) Base price resolution
  const variantPrice = typeof variant?.price === 'number' ? variant.price : undefined;
  let unitPrice = typeof variantPrice === 'number' ? variantPrice : product.price;

  // 2) Wholesale tiers (variant first, then product)
  const unitAfterVariantTier = applyPricingTier(unitPrice, qty, variant?.pricingTiers);
  const tierAppliedVariant = unitAfterVariantTier !== unitPrice;
  unitPrice = unitAfterVariantTier;
  const unitAfterProductTier = applyPricingTier(unitPrice, qty, product.pricingTiers);
  const tierApplied = unitAfterProductTier !== unitPrice || tierAppliedVariant;
  unitPrice = unitAfterProductTier;

  let appliedTier: AppliedPricingTier | undefined;
  if (tierApplied) {
    const tiers = variant?.pricingTiers || product.pricingTiers || [];
    const applicable = tiers.filter((t) => qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty));
    if (applicable.length > 0) {
      const bestTier = applicable.sort((a, b) => b.minQty - a.minQty)[0];
      appliedTier = {
        minQty: bestTier.minQty,
        maxQty: bestTier.maxQty,
        strategy: bestTier.strategy,
        value: bestTier.value,
        appliedPrice: unitPrice,
      };
    }
  }

  // 3) No static discounts - all discounts come from Sales only

  // 4) Sale discount
  let appliedDiscountPct = 0;
  let discountAmount = 0;

  if (saleContext?.discount && saleContext.discount > 0) {
    appliedDiscountPct = saleContext.discount;
    const saleBasePrice = typeof variantPrice === 'number' ? variantPrice : product.price;
    unitPrice = Math.max(0, saleBasePrice - (saleBasePrice * saleContext.discount) / 100);
    discountAmount = (saleBasePrice * saleContext.discount) / 100;
  } else if (saleContext?.amountOff && saleContext.amountOff > 0) {
    const saleBasePrice = typeof variantPrice === 'number' ? variantPrice : product.price;
    unitPrice = Math.max(0, saleBasePrice - saleContext.amountOff);
    discountAmount = saleContext.amountOff;
    appliedDiscountPct = (saleContext.amountOff / saleBasePrice) * 100;
  }

  const totalPrice = unitPrice * qty;
  const totalDiscountAmount = discountAmount * qty;

  return {
    unitPrice,
    totalPrice,
    appliedDiscount: appliedDiscountPct,
    discountAmount: totalDiscountAmount,
    pricingTier: appliedTier,
  };
}

/**
 * Adds an item to the cart or updates quantity if item already exists.
 * Creates cart document if it doesn't exist for the user.
 */
const addToCart = async (
  userId: string,
  productId: string,
  qty: number,
  attributes: { name: string; value: string }[]
): Promise<CustomResponseType<CartType>> => {
  try {
    // Use aggregation pipeline to get product data and validate stock
    const productData = await Product.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(productId) } },
      {
        $lookup: {
          from: 'sales',
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$product', '$$productId'] },
                isActive: true,
                deleted: { $ne: true },
              },
            },
          ],
          as: 'activeSales',
        },
      },
    ]);

    if (!productData.length) {
      return { message: 'Product not found', data: null, code: 404 };
    }

    const product = productData[0];

    if (qty > product.stock) {
      return { message: 'Insufficient stock', data: null, code: 400 };
    }

    // Identify variant
    const variant = resolveVariant(product as unknown as ProductPricingShape, attributes);

    // Check for active sales
    const activeSale = product.activeSales.length > 0 ? product.activeSales[0] : null;
    let saleInfo: Partial<Pick<ChangedSaleInfo, 'sale' | 'saleVariantIndex'>> = {};
    let saleContext: Partial<{ discount: number; amountOff: number }> = {};

    if (activeSale) {
      const { available, variantIndex } = checkSaleAvailability(activeSale, attributes);
      if (available) {
        saleInfo = {
          sale: activeSale._id,
          saleVariantIndex: typeof variantIndex === 'number' ? variantIndex : undefined,
        };

        if (activeSale.variants && variantIndex !== undefined && activeSale.variants[variantIndex]) {
          const saleVariant = activeSale.variants[variantIndex];
          saleContext = {
            discount: saleVariant.discount || 0,
            amountOff: saleVariant.amountOff || 0,
          };
        }
      }
    }

    // Create product snapshot
    const productSnapshot = {
      name: product.name,
      price: product.price,
      sku: product.sku,
    };

    const newItem = {
      product: productId,
      qty,
      productSnapshot,
      selectedAttributes: attributes,
      addedAt: new Date(),
    };

    // Use aggregation pipeline to check if item already exists and update or insert
    const result = await Cart.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $addFields: {
          existingItemIndex: {
            $indexOfArray: [
              '$items',
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$items',
                      cond: {
                        $and: [
                          { $eq: ['$$this.product', new mongoose.Types.ObjectId(productId)] },
                          { $eq: ['$$this.selectedAttributes', attributes] },
                        ],
                      },
                    },
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
    ]);

    if (result.length > 0 && result[0].existingItemIndex !== -1) {
      // Item exists, update quantity only
      await Cart.findOneAndUpdate(
        {
          user: userId,
          'items.product': productId,
          'items.selectedAttributes': attributes,
        },
        {
          $inc: { 'items.$.qty': qty },
          $set: {
            lastActivity: new Date(),
          },
        },
        { new: true }
      );
    } else {
      // Add new item or create cart
      await Cart.findOneAndUpdate(
        { user: userId },
        {
          $push: { items: newItem },
          $set: { lastActivity: new Date() },
        },
        { new: true, upsert: true }
      );
    }

    // No need to recalculate totals since we don't store them
    const updatedCart = await Cart.findOne({ user: userId });
    return { message: 'Item added to cart successfully', data: updatedCart, code: 200 };
  } catch (error) {
    console.error('Error adding item to cart:', error);
    return { message: 'Failed to add item to cart', data: null, code: 500 };
  }
};

/**
 * Clears the entire cart for a user by deleting the cart document.
 */
const clearCart = async (userId: string): Promise<CustomResponseType> => {
  try {
    const result = await Cart.deleteOne({ user: userId });
    if (result.deletedCount === 0) {
      return {
        message: 'Cart not found or already empty',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Cart cleared successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error clearing cart:', error);
    return {
      message: 'Failed to clear cart',
      data: null,
      code: 500,
    };
  }
};

/**
 * Removes a specific item from the cart based on product ID and attributes.
 */
const removeFromCart = async (userId: string, itemId: string): Promise<CustomResponseType<CartType>> => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      {
        $pull: { items: { _id: new mongoose.Types.ObjectId(itemId) } },
        $set: { lastActivity: new Date() },
      },
      { new: true }
    );

    if (!cart) {
      return {
        message: 'Cart not found',
        data: null,
        code: 404,
      };
    }

    // If no items left, delete the cart
    if (cart.items.length === 0) {
      await Cart.deleteOne({ user: userId });
      return {
        message: 'Item removed and cart cleared',
        data: null,
        code: 200,
      };
    }

    // Recalculate totals
    await recalculateCartTotals(userId);
    const updatedCart = await Cart.findOne({ user: userId });

    return {
      message: 'Item removed from cart successfully',
      data: updatedCart,
      code: 200,
    };
  } catch (error) {
    console.error('Error removing item from cart:', error);
    return {
      message: 'Failed to remove item from cart',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates a specific item in the cart (quantity, attributes, etc.).
 */
const updateCartItem = async (
  userId: string,
  itemId: string,
  updates: {
    qty?: number;
    selectedAttributes?: { name: string; value: string }[];
  }
): Promise<CustomResponseType<CartType>> => {
  try {
    const cart = await Cart.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $unwind: '$items' },
      { $match: { 'items._id': new mongoose.Types.ObjectId(itemId) } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productData',
        },
      },
      {
        $lookup: {
          from: 'sales',
          let: { productId: '$items.product' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$product', '$$productId'] },
                isActive: true,
                deleted: { $ne: true },
              },
            },
          ],
          as: 'activeSales',
        },
      },
    ]);

    if (!cart.length || !cart[0].productData.length) {
      return { message: 'Cart item or product not found', data: null, code: 404 };
    }

    const cartItem = cart[0].items;
    const product = cart[0].productData[0];
    const newQty = updates.qty || cartItem.qty;
    const newAttributes = updates.selectedAttributes || cartItem.selectedAttributes;

    if (newQty > product.stock) {
      return { message: 'Insufficient stock', data: null, code: 400 };
    }

    // Update the specific item (only store basic data, no pricing)
    const updatedCart = await Cart.findOneAndUpdate(
      { user: userId, 'items._id': new mongoose.Types.ObjectId(itemId) },
      {
        $set: {
          'items.$.qty': newQty,
          'items.$.selectedAttributes': newAttributes,
          lastActivity: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedCart) {
      return { message: 'Failed to update cart item', data: null, code: 400 };
    }

    const finalCart = await Cart.findOne({ user: userId });

    return { message: 'Cart item updated successfully', data: finalCart, code: 200 };
  } catch (error) {
    console.error('Error updating cart item:', error);
    return { message: 'Failed to update cart item', data: null, code: 500 };
  }
};

/**
 * This function is no longer needed since we calculate totals dynamically
 * Keeping for backward compatibility but it does nothing
 */
const recalculateCartTotals = async (userId: string): Promise<void> => {
  // No longer needed - totals are calculated dynamically when fetching cart
  return;
};

/**
 * Apply coupon to cart
 */
const applyCoupon = async (userId: string, couponCode: string): Promise<CustomResponseType<CartType>> => {
  try {
    // Use aggregation to get cart with coupon validation
    const result = await Cart.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'coupons',
          pipeline: [
            {
              $match: {
                coupon: couponCode.toUpperCase(),
                active: true,
                deleted: { $ne: true },
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
              },
            },
          ],
          as: 'couponData',
        },
      },
    ]);

    if (!result.length) {
      return { message: 'Cart not found', data: null, code: 404 };
    }

    if (!result[0].couponData.length) {
      return { message: 'Invalid or expired coupon', data: null, code: 400 };
    }

    const cart = result[0];
    const coupon = result[0].couponData[0];

    // Check if coupon already applied
    const alreadyApplied = (cart.appliedCoupons as Array<{ coupon: mongoose.Types.ObjectId }> | undefined)?.some(
      (ac) => ac.coupon.toString() === coupon._id.toString()
    );

    if (alreadyApplied) {
      return { message: 'Coupon already applied', data: null, code: 400 };
    }

    // Calculate minimum order value check (need to calculate dynamically)
    // For now, we'll use a basic price calculation for validation
    let cartSubtotal = 0;
    for (const item of cart.items as Array<any>) {
      const product = await Product.findById(item.product);
      if (product) {
        const itemPrice = product.price * item.qty;
        cartSubtotal += itemPrice;
      }
    }

    // Check minimum order value
    if (cartSubtotal < coupon.minOrderValue) {
      return {
        message: `Minimum order value of ${coupon.minOrderValue} required`,
        data: null,
        code: 400,
      };
    }

    // Apply coupon (store only coupon reference, not calculated discount)
    await Cart.findOneAndUpdate(
      { user: userId },
      {
        $push: {
          appliedCoupons: {
            coupon: coupon._id,
            code: couponCode.toUpperCase(),
            appliedAt: new Date(),
          },
        },
        $set: { lastActivity: new Date() },
      },
      { new: true }
    );

    // Update coupon usage
    await Coupon.findByIdAndUpdate(coupon._id, {
      $inc: { timesUsed: 1 },
      $addToSet: { usedBy: new mongoose.Types.ObjectId(userId) },
    });

    const finalCart = await Cart.findOne({ user: userId });

    return { message: 'Coupon applied successfully', data: finalCart, code: 200 };
  } catch (error) {
    console.error('Error applying coupon:', error);
    return { message: 'Failed to apply coupon', data: null, code: 500 };
  }
};

/**
 * Remove coupon from cart
 */
const removeCoupon = async (userId: string, couponId: string): Promise<CustomResponseType<CartType>> => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      {
        $pull: { appliedCoupons: { coupon: new mongoose.Types.ObjectId(couponId) } },
        $set: { lastActivity: new Date() },
      },
      { new: true }
    );

    if (!cart) {
      return { message: 'Cart not found', data: null, code: 404 };
    }

    const updatedCart = await Cart.findOne({ user: userId });

    return { message: 'Coupon removed successfully', data: updatedCart, code: 200 };
  } catch (error) {
    console.error('Error removing coupon:', error);
    return { message: 'Failed to remove coupon', data: null, code: 500 };
  }
};

/**
 * Validates the cart against current sales and discounts.
 * Since we calculate pricing dynamically, this function simply checks
 * if any items in the cart need to be re-evaluated due to sales changes.
 */
export async function validateCartSales(
  userId: string
): Promise<{ valid: boolean; message: string; changed: ChangedEntry[] }> {
  try {
    // Since we calculate pricing dynamically, cart is always "valid"
    // but we can still check for product availability and basic validation
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    
    if (!cart) {
      return { valid: true, message: 'Cart not found', changed: [] };
    }

    const changed: ChangedEntry[] = [];
    
    // Check for basic product availability (products that might have been deleted)
    for (const item of cart.items) {
      if (!item.product) {
        changed.push({
          itemId: item._id,
          product: item.product,
          old: {},
          current: {},
        });
      }
    }

    return {
      valid: changed.length === 0,
      message: changed.length === 0 ? 'Cart is valid' : 'Some products are no longer available',
      changed,
    };
  } catch (error) {
    console.error('Error validating cart:', error);
    return { valid: false, message: 'Error validating cart', changed: [] };
  }
}

/**
 * Get cart with full details and dynamically calculated pricing using aggregation pipeline
 */
type CartItemType = CartType['items'][number];
type AppliedCoupon = CartType['appliedCoupons'][number];

export type CartItemWithPricing = CartItemType & {
  productDetails?: ProductType | null;
  unitPrice: number;
  totalPrice: number;
  appliedDiscount: number;
  discountAmount: number;
  pricingTier?: AppliedPricingTier;
};

export type CartWithDetails = Omit<CartType, 'items' | 'appliedCoupons'> & {
  items: CartItemWithPricing[];
  appliedCoupons: Array<AppliedCoupon & { couponDetails?: CouponType | null; discountAmount: number }>;
  subtotal: number;
  totalDiscount: number;
  couponDiscount: number;
  total: number;
};

const getCartItems = async (userId: string): Promise<CustomResponseType<CartWithDetails>> => {
  try {
    const result = await Cart.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $lookup: {
          from: 'sales',
          let: { productIds: '$items.product' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$product', '$$productIds'] },
                isActive: true,
                deleted: { $ne: true },
              },
            },
          ],
          as: 'salesDetails',
        },
      },
      {
        $lookup: {
          from: 'coupons',
          localField: 'appliedCoupons.coupon',
          foreignField: '_id',
          as: 'couponDetails',
        },
      },
    ]);

    if (!result.length) {
      return { message: 'Cart not found', data: null, code: 404 };
    }

    const cartData = result[0];
    const items: CartItemWithPricing[] = [];
    let subtotal = 0;
    let totalDiscount = 0;

    // Process each cart item and calculate pricing dynamically
    for (const item of cartData.items) {
      const product = cartData.productDetails.find((p: any) => p._id.toString() === item.product.toString());
      
      if (!product) continue;

      // Find active sale for this product
      const activeSale = cartData.salesDetails.find((s: any) => s.product.toString() === item.product.toString());
      
      let saleContext: Partial<{ discount: number; amountOff: number }> = {};
      
      if (activeSale) {
        const { available, variantIndex, discount, amountOff } = checkSaleAvailability(activeSale, item.selectedAttributes || []);
        if (available && variantIndex !== undefined) {
          saleContext = {
            discount: discount || 0,
            amountOff: amountOff || 0,
          };
        }
      }

      // Resolve variant
      const variant = resolveVariant(product as unknown as ProductPricingShape, item.selectedAttributes || []);

      // Calculate pricing dynamically
      const pricing = calculateItemPricing({
        product: product as unknown as ProductPricingShape,
        variant,
        qty: item.qty,
        saleContext,
      });

      const itemWithPricing: CartItemWithPricing = {
        ...item,
        productDetails: product,
        unitPrice: pricing.unitPrice,
        totalPrice: pricing.totalPrice,
        appliedDiscount: pricing.appliedDiscount,
        discountAmount: pricing.discountAmount,
        pricingTier: pricing.pricingTier,
      };

      items.push(itemWithPricing);
      subtotal += pricing.totalPrice;
      totalDiscount += pricing.discountAmount;
    }

    // Calculate coupon discounts dynamically
    const appliedCoupons = cartData.appliedCoupons?.map((coupon: any) => {
      const couponDetails = cartData.couponDetails.find((c: any) => c._id.toString() === coupon.coupon.toString());
      
      let discountAmount = 0;
      if (couponDetails) {
        if (couponDetails.discountType === 'percentage') {
          discountAmount = (subtotal * couponDetails.discount) / 100;
        } else {
          discountAmount = Math.min(couponDetails.discount, subtotal);
        }
      }

      return {
        ...coupon,
        couponDetails,
        discountAmount,
      };
    }) || [];

    const couponDiscount = appliedCoupons.reduce((sum: number, coupon: any) => sum + coupon.discountAmount, 0);
    const total = Math.max(0, subtotal - couponDiscount);

    const cartWithDetails: CartWithDetails = {
      ...cartData,
      items,
      appliedCoupons,
      subtotal,
      totalDiscount,
      couponDiscount,
      total,
    };

    return {
      message: 'Cart items retrieved successfully',
      data: cartWithDetails,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching cart items:', error);
    return { message: 'Failed to fetch cart items', data: null, code: 500 };
  }
};

const CartService = {
  getCartItems,
  addToCart,
  removeFromCart,
  clearCart,
  updateCartItem,
  validateCartSales,
  applyCoupon,
  removeCoupon,
  recalculateCartTotals,
};

export default CartService;
