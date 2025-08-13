import Product, { ProductType } from '../../models/Product';
import slugify from 'slugify';
import { CustomResponseType } from '@/types';
import eventPublisher from '@/events/eventPublisher';

// Pricing types to mirror model
type PricingTier = {
  minQty: number;
  maxQty: number;
  strategy: 'fixedPrice' | 'percentOff' | 'amountOff';
  value: number;
};

/**
 * Creates a new product.
 * @param data - The data for the new product.
 */
type CreateProductData = {
  name: string;
  description: string;
  brand: string;
  price: number;
  category: string;
  subCategories?: string;
  description_images: { url: string; cover_image?: boolean }[];
  specifications: { key: string; value: string }[];
  shipping: number;
  deliveryTime: number;
  attributes?: {
    name: string;
    children: {
      name: string;
      price?: number;
      discount?: number;
      stock: number;
      image: string;
      pricingTiers?: PricingTier[];
    }[];
  }[];
  tags: string[];
  stock: number;
  discount?: number;
  pricingTiers?: PricingTier[]; // optional at product level
};

function validatePricingTiers(tiers?: PricingTier[]): string | null {
  if (!tiers || tiers.length === 0) return null;
  // Basic checks
  for (const t of tiers) {
    if (t.minQty < 1) return 'minQty must be >= 1';
    if (t.maxQty < t.minQty) return 'maxQty must be >= minQty';
    if (!['fixedPrice', 'percentOff', 'amountOff'].includes(t.strategy)) return 'Invalid pricing strategy';
    if (t.value < 0) return 'value must be >= 0';
  }
  // Sort and check overlaps
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (curr.minQty <= prev.maxQty) {
      return 'Pricing tier ranges must not overlap';
    }
  }
  return null;
}

const createProduct = async (data: CreateProductData): Promise<CustomResponseType<ProductType>> => {
  try {
    const newData: CreateProductData & { slug?: string } = data;
    newData.slug = slugify(data.name);

    // Validate pricing tiers at product level
    const productTierErr = validatePricingTiers(newData.pricingTiers);
    if (productTierErr) {
      return { message: productTierErr, data: null, code: 400 };
    }
    // Validate variant-level tiers
    if (Array.isArray(newData.attributes)) {
      for (const group of newData.attributes) {
        for (const child of group.children) {
          const childErr = validatePricingTiers(child.pricingTiers);
          if (childErr) return { message: `Variant "${group.name}/${child.name}": ${childErr}`, data: null, code: 400 };
        }
      }
    }

    const newProduct = await Product.insertOne(newData);
    return {
      message: 'Product created successfully',
      data: newProduct,
      code: 201,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates an existing product.
 * @param id - The ID of the product to update.
 * @param data - The updated data for the product.
 */
const updateProduct = async (
  id: string,
  data: Partial<CreateProductData>
): Promise<CustomResponseType<ProductType>> => {
  try {
    const existing = await Product.findById(id);
    if (!existing) {
      return { message: 'Product not found', data: null, code: 404 };
    }

    // Validate pricing tiers if present
    if (data.pricingTiers) {
      const err = validatePricingTiers(data.pricingTiers);
      if (err) return { message: err, data: null, code: 400 };
    }
    if (Array.isArray(data.attributes)) {
      for (const group of data.attributes) {
        if (!group?.children) continue;
        for (const child of group.children) {
          const e = validatePricingTiers(child.pricingTiers);
          if (e) return { message: `Variant "${group.name}/${child.name}": ${e}`, data: null, code: 400 };
        }
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, data, { new: true });
    if (!updatedProduct) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    // Emit price-change events when base price or discount changes
    const oldPrice = Number(existing.price);
    const newPrice = Number(data.price ?? existing.price);
    const oldDiscount = Number(existing.discount || 0);
    const newDiscount = Number(data.discount ?? existing.discount ?? 0);

    if (oldPrice !== newPrice || oldDiscount !== newDiscount) {
      try {
        await eventPublisher.publishPriceChanged(
          id,
          oldPrice,
          newPrice,
          newDiscount !== oldDiscount ? newDiscount : undefined
        );
      } catch (e) {
        console.warn('Failed to publish price change event:', e);
      }
    }
    return {
      message: 'Product updated successfully',
      data: updatedProduct,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a product.
 * @param id - The ID of the product to delete.
 */
const deleteProduct = async (id: string): Promise<CustomResponseType<void>> => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Product deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets a product by its ID.
 * @param id - The ID of the product.
 */
const getProductById = async (id: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const product = await Product.findById(id);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Product retrieved successfully',
      data: product,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Duplicates an existing product.
 * @param id - The ID of the product to duplicate.
 */
const duplicateProduct = async (id: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const product = await Product.findById(id);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    const duplicatedProductData = {
      ...product.toObject(),
      createdAt: undefined,
      updatedAt: undefined,
      status: 'inactive',
      _id: undefined,
      slug: `${product.slug}-copy`,
      name: `${product.name} (Copy)`,
    };

    const duplicatedProduct = await Product.create(duplicatedProductData);
    return {
      message: 'Product duplicated successfully',
      data: duplicatedProduct,
      code: 201,
    };
  } catch (error) {
    console.error('Error duplicating product:', error);
    return {
      message: 'Failed to duplicate product',
      data: null,
      code: 500,
    };
  }
};

// Add a function to update the cover image of a product
const updateCoverImage = async (productId: string, imageUrl: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    // Update the cover image
    product.description_images.forEach((image) => {
      image.cover_image = image.url === imageUrl;
    });

    await product.save();

    return {
      message: 'Cover image updated successfully',
      data: product,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating cover image:', error);
    return {
      message: 'Failed to update cover image',
      data: null,
      code: 500,
    };
  }
};

const Admin_ProductService = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  duplicateProduct,
  updateCoverImage,
};

export default Admin_ProductService;
