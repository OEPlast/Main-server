import Product, { ProductType } from '../../models/Product';
import slugify from 'slugify';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import mongoose, { PipelineStage } from 'mongoose';
import eventPublisher from '@/events/eventPublisher';
import { duplicateMessage, isDuplicateKeyError } from '@/middleware/mongodb';
import Category from '@/models/Category';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pricing types to mirror model
type PricingTier = {
  minQty: number;
  maxQty?: number;
  strategy: 'fixedPrice' | 'percentOff' | 'amountOff';
  value: number;
};

/**
 * Creates a new product.
 * @param data - The data for the new product.
 */
type CreateProductData = {
  sku: number;
  name: string;
  description: string;
  price: number;
  slug?: string;
  brand?: string;
  category: string; // Category id
  tags?: string[];
  description_images?: { url: string; cover_image?: boolean }[];
  specifications?: { key: string; value: string }[];
  dimension?: { key: 'length' | 'breadth' | 'height' | 'volume' | 'width' | 'weight'; value: string }[];
  shipping?: { addedCost?: number; increaseCostBy?: number; addedDays?: number };
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
  pricingTiers?: PricingTier[];
  stock: number;
  lowStockThreshold?: number;
  discount?: number;
  status?: 'active' | 'inactive' | 'archived';
};

function validatePricingTiers(tiers?: PricingTier[]): string | null {
  if (!tiers || tiers.length === 0) return null;
  // Basic checks
  for (const t of tiers) {
    if (t.minQty < 1) return 'minQty must be >= 1';
    if (t.maxQty != null && t.maxQty < t.minQty) return 'maxQty must be >= minQty';
    if (!['fixedPrice', 'percentOff', 'amountOff'].includes(t.strategy)) return 'Invalid pricing strategy';
    if (t.value < 0) return 'value must be >= 0';
  }
  // Sort and check overlaps
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    // Non-overlap: current.min must be greater than previous.max (or previous open-ended means invalid)
    if (prev.maxQty == null) return 'Open-ended tier must be the last tier';
    if (curr.minQty <= prev.maxQty) return 'Pricing tier ranges must not overlap';
  }
  // only last can be open-ended
  const openEndedCount = sorted.filter((t) => t.maxQty == null).length;
  if (openEndedCount > 1) return 'Only one open-ended tier (without maxQty) is allowed';
  if (openEndedCount === 1 && sorted[sorted.length - 1]?.maxQty != null) return 'Open-ended tier must be the last tier';
  return null;
}

const createProduct = async (data: CreateProductData): Promise<CustomResponseType<ProductType>> => {
  try {
    // Basic SKU validation to align with model (required number)
    if (data == null || typeof data.sku !== 'number' || Number.isNaN(data.sku)) {
      return { message: 'sku is required and must be a number', data: null, code: 400 };
    }
    const newData: CreateProductData & { slug?: string } = { ...data };
    newData.slug = slugify(data.name, { lower: true, strict: true });

    // ensure unique slug by suffixing when needed
    const baseSlug = newData.slug;
    let suffix = 1;
    while (await Product.exists({ slug: newData.slug })) {
      newData.slug = `${baseSlug}-${suffix++}`;
    }

    // Validate pricing tiers at product level
    const isThereProductTierError = validatePricingTiers(newData.pricingTiers);
    if (isThereProductTierError) {
      return { message: isThereProductTierError, data: null, code: 400 };
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

    const newProduct = await Product.create(newData);
    return {
      message: 'Product created successfully',
      data: newProduct as unknown as ProductType,
      code: 201,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { message: duplicateMessage(error, 'Product'), data: null, code: 400 };
    }
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

    // Validate sku if present
    if (Object.prototype.hasOwnProperty.call(data, 'sku')) {
      if (typeof data.sku !== 'number' || Number.isNaN(data.sku)) {
        return { message: 'sku must be a number when provided', data: null, code: 400 };
      }
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

    // Slugify name if provided
    if (data.name) {
      const newSlug = slugify(data.name, { lower: true, strict: true });
      if (newSlug && newSlug !== existing.slug) {
        let candidate = newSlug;
        let k = 1;
        while (await Product.exists({ slug: candidate, _id: { $ne: existing._id } })) {
          candidate = `${newSlug}-${k++}`;
        }
        (data as Partial<ProductType>).slug = candidate as unknown as ProductType['slug'];
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
    if (isDuplicateKeyError(error)) {
      return { message: duplicateMessage(error, 'Product'), data: null, code: 400 };
    }
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
const updateCoverImage = async (productId: string, imageId: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const session = await mongoose.startSession();
    let resultDoc: ProductType | null = null;
    await session.withTransaction(async () => {
      const exists = await Product.exists({ _id: productId }).session(session);
      if (!exists) {
        throw new Error('NOT_FOUND');
      }
      await Product.updateOne(
        { _id: productId },
        { $set: { 'description_images.$[].cover_image': false } },
        { session }
      ).exec();
      const u = await Product.findOneAndUpdate(
        { _id: productId },
        { $set: { 'description_images.$[elem].cover_image': true } },
        { arrayFilters: [{ 'elem._id': imageId }], new: true, session }
      )
        .lean<ProductType>()
        .exec();
      resultDoc = u as ProductType | null;
    });
    await session.endSession();

    if (!resultDoc) {
      return { message: 'Product not found or image not matched', data: null, code: 404 };
    }
    return { message: 'Cover image updated successfully', data: resultDoc, code: 200 };
  } catch (error) {
    console.error('Error updating cover image:', error);
    return {
      message: 'Failed to update cover image',
      data: null,
      code: 500,
    };
  }
};

// Array editors
const addTags = async (productId: string, tags: string[]): Promise<CustomResponseType<ProductType>> => {
  try {
    const doc = await Product.findOneAndUpdate(
      { _id: productId },
      { $addToSet: { tags: { $each: tags } } },
      { new: true }
    )
      .lean<ProductType>()
      .exec();
    if (!doc) return { message: 'Product not found', data: null, code: 404 };
    return { message: 'Tags added', data: doc, code: 200 };
  } catch (e) {
    console.error(e);
    return { message: 'Failed to add tags', data: null, code: 500 };
  }
};

const removeTag = async (productId: string, tag: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const doc = await Product.findOneAndUpdate({ _id: productId }, { $pull: { tags: tag } }, { new: true })
      .lean<ProductType>()
      .exec();
    if (!doc) return { message: 'Product not found', data: null, code: 404 };
    return { message: 'Tag removed', data: doc, code: 200 };
  } catch (e) {
    console.error(e);
    return { message: 'Failed to remove tag', data: null, code: 500 };
  }
};

const addSpecifications = async (
  productId: string,
  specs: Array<{ key: string; value: string }>
): Promise<CustomResponseType<ProductType>> => {
  try {
    const doc = await Product.findOneAndUpdate(
      { _id: productId },
      { $push: { specifications: { $each: specs } } },
      { new: true }
    )
      .lean<ProductType>()
      .exec();
    if (!doc) return { message: 'Product not found', data: null, code: 404 };
    return { message: 'Specifications added', data: doc, code: 200 };
  } catch (e) {
    console.error(e);
    return { message: 'Failed to add specifications', data: null, code: 500 };
  }
};

const removeSpecification = async (productId: string, key: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const doc = await Product.findOneAndUpdate(
      { _id: productId },
      { $pull: { specifications: { key } } },
      { new: true }
    )
      .lean<ProductType>()
      .exec();
    if (!doc) return { message: 'Product not found', data: null, code: 404 };
    return { message: 'Specification removed', data: doc, code: 200 };
  } catch (e) {
    console.error(e);
    return { message: 'Failed to remove specification', data: null, code: 500 };
  }
};

/**
 * Fetches all products with filters via aggregation pipeline.
 */
type ListProductsParams = {
  page?: number;
  limit?: number;
  category?: string;
  subcategory?: string;
  search?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'name' | 'createdAt' | 'rating' | 'sales';
  sortOrder?: 'asc' | 'desc';
  availability?: 'in-stock' | 'out-of-stock' | 'low-stock';
  specKey?: string;
  specValue?: string;
};

const getAllProducts = async (
  params: ListProductsParams
): Promise<
  CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }>
> => {
  try {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;
    const sortOrderNum: 1 | -1 = params.sortOrder === 'asc' ? 1 : -1;

    const match: Record<string, unknown> = {};
    const and: Record<string, unknown>[] = [];

    if (params.category) {
      // Allow passing category either as ID or name. Prefer ID if valid; otherwise try name.
      let categoryMatch: unknown = params.category;
      try {
        categoryMatch = new mongoose.Types.ObjectId(params.category);
        and.push({ category: categoryMatch });
      } catch {
        const cat = await Category.findOne({ name: new RegExp(`^${escapeRegex(params.category)}$`, 'i') }).select(
          '_id'
        );
        if (cat) and.push({ category: cat._id });
      }
    }
    if (params.search) {
      const rx = new RegExp(params.search, 'i');
      and.push({
        $or: [{ name: rx }],
      });
    }
    if (params.brand) {
      and.push({ brand: { $regex: params.brand, $options: 'i' } });
    }
    if (typeof params.minPrice === 'number' || typeof params.maxPrice === 'number') {
      const priceCond: Record<string, number> = {};
      if (typeof params.minPrice === 'number') priceCond.$gte = params.minPrice;
      if (typeof params.maxPrice === 'number') priceCond.$lte = params.maxPrice;
      and.push({ price: priceCond });
    }
    // Specifications filter support
    if (params.specKey && params.specValue) {
      and.push({
        specifications: {
          $elemMatch: {
            key: new RegExp(`^${escapeRegex(params.specKey)}$`, 'i'),
            value: new RegExp(escapeRegex(params.specValue), 'i'),
          },
        },
      });
    }
    if (params.availability === 'in-stock') {
      and.push({ stock: { $gt: 0 } });
    } else if (params.availability === 'out-of-stock') {
      and.push({ stock: { $eq: 0 } });
    } else if (params.availability === 'low-stock') {
      and.push({ $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] } });
    }

    if (and.length) match.$and = and;

    const pipeline: PipelineStage[] = [];
    if (Object.keys(match).length) pipeline.push({ $match: match });

    // Category populate via $lookup
    pipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    );

    // Optional sales-based sorting
    if (params.sortBy === 'sales') {
      pipeline.push(
        {
          $lookup: {
            from: 'orders',
            let: { pid: '$_id' },
            pipeline: [
              { $unwind: '$products' },
              { $match: { $expr: { $eq: ['$products.product', '$$pid'] } } },
              { $count: 'count' },
            ],
            as: 'salesAgg',
          },
        },
        { $addFields: { salesCount: { $ifNull: [{ $arrayElemAt: ['$salesAgg.count', 0] }, 0] } } },
        { $project: { salesAgg: 0 } }
      );
    }

    // Sorting
    const sortStage: Record<string, 1 | -1> = {};
    if (params.sortBy === 'sales') sortStage.salesCount = sortOrderNum;
    else if (params.sortBy === 'price') sortStage.price = sortOrderNum;
    else if (params.sortBy === 'name') sortStage.name = sortOrderNum;
    else if (params.sortBy === 'rating') sortStage.rating = sortOrderNum as 1 | -1; // rating may not exist
    else sortStage.createdAt = sortOrderNum; // default newest

    pipeline.push({ $sort: sortStage });

    // Facet for data and total count
    pipeline.push(
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                price: 1,
                sku: 1,
                tags: 1,
                slug: 1,
                category: {
                  _id: '$category._id',
                  name: '$category.name',
                  image: '$category.image',
                  slug: '$category.slug',
                },
                description_images: {
                  $filter: {
                    input: '$description_images',
                    as: 'img',
                    cond: { $eq: ['$$img.cover_image', true] },
                  },
                },
              },
            },
          ],
          totalCount: [{ $count: 'total' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$totalCount.total', 0] }, 0] },
        },
      }
    );

    const agg = await Product.aggregate(pipeline).exec();
    const products = (agg[0]?.data as ProductType[]) || [];
    const total = (agg[0]?.total as number) || 0;

    return {
      message: 'Products retrieved successfully',
      data: products,
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return { message: 'Failed to fetch products', data: null, code: 500 };
  }
};

const Admin_ProductService = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  duplicateProduct,
  updateCoverImage,
  addTags,
  removeTag,
  addSpecifications,
  removeSpecification,
  getAllProducts,
};

export default Admin_ProductService;
