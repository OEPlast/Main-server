import Cart, { CartType } from '@/models/Cart';
import Product from '@/models/Product';
import { CustomResponseType } from '@/types';
import { findActiveSaleForProduct, checkSaleAvailability } from '@/helpers/salesUtils';
import { ProductPricingShape, VariantOption, resolveBestVariant, applyPricingTier } from '@/helpers/pricingUtils';

/**
 * Validates the cart against current sales and discounts.
 * Returns an array of products with sale changes or invalid sales.
 */

// Define changed entry types to avoid any
type ChangedSaleInfo = {
  sale?: CartType['products'][number]['sale'];
  saleType?: CartType['products'][number]['saleType'];
  saleDiscount?: CartType['products'][number]['saleDiscount'];
  saleVariantIndex?: CartType['products'][number]['saleVariantIndex'];
};

type ChangedEntry = {
  product: CartType['products'][number]['product'];
  old: ChangedSaleInfo;
  current: ChangedSaleInfo;
};

// Use multi-attribute resolver
const resolveVariant = resolveBestVariant;

// Pricing helpers
function calculateUnitPrice({
  product,
  variant,
  qty,
  saleContext,
}: {
  product: ProductPricingShape;
  variant?: VariantOption;
  qty: number;
  saleContext?: { discount?: number };
}): { unitPrice: number; applied: { base: number; variantPrice?: number; tier?: string; discountPct?: number } } {
  // 1) Base price resolution
  const variantPrice = typeof variant?.price === 'number' ? variant.price : undefined;
  let unit = typeof variantPrice === 'number' ? variantPrice : product.price;
  const base = unit;

  // 2) Wholesale tiers (variant first, then product)
  const unitAfterVariantTier = applyPricingTier(unit, qty, variant?.pricingTiers);
  const tierAppliedVariant = unitAfterVariantTier !== unit ? 'variant' : undefined;
  unit = unitAfterVariantTier;
  const unitAfterProductTier = applyPricingTier(unit, qty, product.pricingTiers);
  const tierApplied = unitAfterProductTier !== unit ? 'product' : tierAppliedVariant;
  unit = unitAfterProductTier;

  // 3) Static discounts (prefer variant discount if present)
  const variantDiscountPct = typeof variant?.discount === 'number' ? variant.discount : undefined;
  const productDiscountPct = typeof product.discount === 'number' ? product.discount : 0;
  const staticDiscountPct = typeof variantDiscountPct === 'number' ? variantDiscountPct : productDiscountPct;
  if (staticDiscountPct && staticDiscountPct > 0) {
    unit = Math.max(0, unit - (unit * staticDiscountPct) / 100);
  }

  // 4) Sale discount (overrides static discount precedence)
  const salePct = typeof saleContext?.discount === 'number' ? saleContext.discount : 0;
  if (salePct > 0) {
    unit = Math.max(
      0,
      (typeof variantPrice === 'number' ? variantPrice : product.price) -
        ((typeof variantPrice === 'number' ? variantPrice : product.price) * salePct) / 100
    );
  }

  return {
    unitPrice: unit,
    applied: {
      base,
      variantPrice,
      tier: tierApplied,
      discountPct: salePct > 0 ? salePct : staticDiscountPct || 0,
    },
  };
}

/**
 * Adds an item to the cart.
 * @param userId - The ID of the user.
 * @param productId - The ID of the product.
 * @param qty - The quantity to add.
 * @param attributes - The attributes of the product.
 */
const addToCart = async (
  userId: string,
  productId: string,
  qty: number,
  attributes: { name: string; value: string }[]
): Promise<CustomResponseType<CartType>> => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return { message: 'Product not found', data: null, code: 404 };
    }

    if (qty > product.stock) {
      return { message: 'Insufficient stock', data: null, code: 400 };
    }

    // Identify variant
    const variant = resolveVariant(product as unknown as ProductPricingShape, attributes);

    // Active sale
    const sale = await findActiveSaleForProduct(productId);
    let saleInfo: {
      sale?: CartType['products'][number]['sale'];
      saleType?: CartType['products'][number]['saleType'];
      saleVariantIndex?: CartType['products'][number]['saleVariantIndex'];
      saleDiscount?: CartType['products'][number]['saleDiscount'];
    } = {};

    let saleDiscount: number | undefined;
    let saleVariantIndex: number | undefined;
    if (sale) {
      const { available, variantIndex, discount } = checkSaleAvailability(sale, attributes);
      if (available) {
        saleDiscount = typeof discount === 'number' ? discount : 0;
        saleVariantIndex = typeof variantIndex === 'number' ? variantIndex : undefined;
        saleInfo = {
          sale: sale._id as unknown as CartType['products'][number]['sale'],
          saleType: sale.type as CartType['products'][number]['saleType'],
          saleVariantIndex: saleVariantIndex as CartType['products'][number]['saleVariantIndex'],
          saleDiscount: saleDiscount as CartType['products'][number]['saleDiscount'],
        };
      }
    }

    const pricing = calculateUnitPrice({
      product: product as unknown as ProductPricingShape,
      variant,
      qty,
      saleContext: { discount: saleDiscount },
    });

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      {
        $push: {
          products: {
            product: productId,
            qty,
            price: pricing.unitPrice,
            attributes,
            ...saleInfo,
          },
        },
      },
      { new: true, upsert: true }
    );

    return { message: 'Item added to cart successfully', data: cart, code: 200 };
  } catch (error) {
    console.error('Error adding item to cart:', error);
    return { message: 'Failed to add item to cart', data: null, code: 500 };
  }
};

/**
 * Clears the entire cart for a user.
 * @param userId - The ID of the user.
 */
const clearCart = async (userId: string): Promise<CustomResponseType> => {
  try {
    const cart = await Cart.findOneAndDelete({ user: userId });
    if (!cart) {
      return {
        message: 'Cart not found',
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
 * Removes an item from the cart.
 * @param userId - The ID of the user.
 * @param productId - The ID of the product to remove.
 */
const removeFromCart = async (userId: string, productId: string): Promise<CustomResponseType<CartType>> => {
  try {
    const cart = await Cart.findOneAndUpdate({ user: userId }, { $pull: { products: { product: productId } } });

    if (!cart) {
      return {
        message: 'Cart not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Item removed from cart successfully',
      data: cart,
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
 * Updates the quantity of an item in the cart.
 * @param userId - The ID of the user.
 * @param productId - The ID of the product to update.
 * @param qty - The new quantity.
 */
const updateCartItem = async (
  userId: string,
  productId: string,
  qty: number
): Promise<CustomResponseType<CartType>> => {
  try {
    const cart = await Cart.findOne({ user: userId }).populate('products.product');
    if (!cart) return { message: 'Cart not found', data: null, code: 404 };

    const item = cart.products.find((p) => p.product && p.product.toString() === productId);
    if (!item) return { message: 'Item not in cart', data: null, code: 404 };

    const productDoc = await Product.findById(productId);
    if (!productDoc) return { message: 'Product not found', data: null, code: 404 };
    if (qty > productDoc.stock) return { message: 'Insufficient stock', data: null, code: 400 };

    // Recompute price with tiers/discounts
    const sale = await findActiveSaleForProduct(productId);
    let saleDiscount: number | undefined;
    if (sale) {
      const { available, discount } = checkSaleAvailability(sale, item.attributes as { name: string; value: string }[]);
      if (available) saleDiscount = typeof discount === 'number' ? discount : 0;
    }

    const variant = resolveVariant(
      productDoc as unknown as ProductPricingShape,
      item.attributes as { name: string; value: string }[]
    );
    const pricing = calculateUnitPrice({
      product: productDoc as unknown as ProductPricingShape,
      variant,
      qty,
      saleContext: { discount: saleDiscount },
    });

    const updated = await Cart.findOneAndUpdate(
      { user: userId, 'products.product': productId },
      { $set: { 'products.$.qty': qty, 'products.$.price': pricing.unitPrice } },
      { new: true }
    );

    return { message: 'Cart item updated successfully', data: updated as unknown as CartType, code: 200 };
  } catch (error) {
    console.error('Error updating cart item:', error);
    return { message: 'Failed to update cart item', data: null, code: 500 };
  }
};

// Validate sales helper
export async function validateCartSales(
  userId: string
): Promise<{ valid: boolean; message: string; changed: ChangedEntry[] }> {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) return { valid: false, message: 'Cart not found', changed: [] };
  const changed: ChangedEntry[] = [];
  for (const item of cart.products) {
    if (!item.product) continue;
    const sale = await findActiveSaleForProduct(item.product.toString());
    let currentDiscount = 0;
    let currentSaleId = undefined as ChangedSaleInfo['sale'];
    let currentSaleType = undefined as ChangedSaleInfo['saleType'];
    let currentVariantIndex = undefined as ChangedSaleInfo['saleVariantIndex'];
    if (sale) {
      const { available, variantIndex, discount } = checkSaleAvailability(sale, item.attributes);
      if (available) {
        currentDiscount = discount || 0;
        currentSaleId = sale._id as unknown as ChangedSaleInfo['sale'];
        currentSaleType = sale.type as ChangedSaleInfo['saleType'];
        currentVariantIndex =
          typeof variantIndex === 'number' ? (variantIndex as ChangedSaleInfo['saleVariantIndex']) : undefined;
      }
    }
    if (
      (item.sale && (!currentSaleId || item.sale.toString() !== currentSaleId.toString())) ||
      item.saleDiscount !== currentDiscount ||
      item.saleType !== currentSaleType ||
      item.saleVariantIndex !== currentVariantIndex
    ) {
      changed.push({
        product: item.product,
        old: {
          sale: item.sale,
          saleType: item.saleType,
          saleDiscount: item.saleDiscount,
          saleVariantIndex: item.saleVariantIndex,
        },
        current: {
          sale: currentSaleId,
          saleType: currentSaleType,
          saleDiscount: currentDiscount,
          saleVariantIndex: currentVariantIndex,
        },
      });
    }
  }
  return {
    valid: changed.length === 0,
    message: changed.length === 0 ? 'Cart sales are valid' : 'Some sales have changed or expired',
    changed,
  };
}

// Fetch cart items
type PopulatedProduct = {
  product: { name: string; price: number };
  qty: number;
  price: number;
  attributes: { name: string; value: string }[];
};
type PopulatedCartType = Omit<CartType, 'products'> & { products: PopulatedProduct[] };

const getCartItems = async (userId: string): Promise<CustomResponseType<PopulatedCartType>> => {
  try {
    const cartItems = (await Cart.findOne({ user: userId }).populate({
      path: 'products.product',
      select: 'name price',
    })) as unknown as PopulatedCartType;
    return { message: 'Cart items retrieved successfully', data: cartItems, code: 200 };
  } catch (error) {
    console.error('Error fetching cart items:', error);
    return { message: 'Failed to fetch cart items', data: null, code: 500 };
  }
};

const CartService = { getCartItems, addToCart, removeFromCart, clearCart, updateCartItem, validateCartSales };
export default CartService;
