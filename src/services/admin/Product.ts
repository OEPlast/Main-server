import Product, { ProductType } from '../../models/Product';
import slugify from 'slugify';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';
import mongoose, { FilterQuery, PipelineStage } from 'mongoose';
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
  description_images?: {
    url: string;
    cover_image?: boolean;
    mediaType?: 'image' | 'video';
    miniUrl?: string;
  }[];
  specifications?: { key: string; value: string }[];
  dimension?: { key: 'length' | 'breadth' | 'height' | 'volume' | 'width' | 'weight'; value: string }[];
  shipping?: { addedCost?: number; increaseCostBy?: number; addedDays?: number };
  // GIG shipping fields
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  isVolumetric?: boolean;
  attributes?: {
    name: string;
    children: {
      name: string;
      price?: number;
      stock: number;
      image: string;
      pricingTiers?: PricingTier[];
    }[];
  }[];
  pricingTiers?: PricingTier[];
  stock: number;
  lowStockThreshold?: number;
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

    // Set originStock to the initial stock value
    const productDataWithOriginStock = {
      ...newData,
      originStock: newData.stock,
    };

    const newProduct = await Product.create(productDataWithOriginStock);
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

    type ProductUpdate = Partial<CreateProductData> & { originStock?: number };
    const update: ProductUpdate = { ...data };
    // Update originStock when stock is being updated
    if (data.stock !== undefined && data.stock !== existing.stock) {
      update.originStock = data.stock;
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, update, { new: true });
    if (!updatedProduct) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    // Emit price-change events when base price changes
    const oldPrice = Number(existing.price);
    const newPrice = Number(data.price ?? existing.price);

    if (oldPrice !== newPrice) {
      try {
        await eventPublisher.publishPriceChanged(id, oldPrice, newPrice);
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
 * Creates a copy with unique name and slug by appending incrementing numbers (-1, -2, etc.)
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

    // Helper function to find next available suffix
    const findNextAvailableName = async (baseName: string): Promise<string> => {
      let counter = 1;
      let productName = `${baseName}-${counter}`;

      while (await Product.exists({ name: productName })) {
        counter++;
        productName = `${baseName}-${counter}`;
      }

      return productName;
    };

    const findNextAvailableSlug = async (baseSlug: string): Promise<string> => {
      let counter = 1;
      let productSlug = `${baseSlug}-${counter}`;

      while (await Product.exists({ slug: productSlug })) {
        counter++;
        productSlug = `${baseSlug}-${counter}`;
      }

      return productSlug;
    };

    // Generate unique name and slug
    const newName = await findNextAvailableName(product.name);
    const newSlug = await findNextAvailableSlug(product.slug);

    // Prepare duplicated product data by spreading and overriding
    const productObj = product.toObject();

    const duplicatedProductData = {
      sku: productObj.sku,
      name: newName,
      description: productObj.description,
      price: productObj.price,
      slug: newSlug,
      category: productObj.category,
      tags: productObj.tags,
      description_images: productObj.description_images,
      specifications: productObj.specifications,
      dimension: productObj.dimension,
      shipping: productObj.shipping,
      pricingTiers: productObj.pricingTiers,
      stock: 0, // Reset stock to 0
      lowStockThreshold: productObj.lowStockThreshold,
      status: 'inactive' as const, // New duplicates start as inactive
      // Reset attribute children stock to 0
      attributes: productObj.attributes?.map((attr) => ({
        name: attr.name,
        children: attr.children?.map((child) => ({
          name: child.name,
          price: child.price,
          stock: 0, // Reset stock
          colorCode: child.colorCode,
          pricingTiers: child.pricingTiers,
        })),
      })),
    };

    const duplicatedProduct = await Product.create(duplicatedProductData);

    return {
      message: 'Product duplicated successfully',
      data: duplicatedProduct,
      code: 201,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { message: duplicateMessage(error, 'Product'), data: null, code: 400 };
    }
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
      const searchTerm = params.search.trim();
      const rx = new RegExp(escapeRegex(searchTerm), 'i');

      // Build $or conditions for name, sku, and _id
      const searchConditions: Record<string, unknown>[] = [
        { name: rx },
        { sku: isNaN(Number(searchTerm)) ? -1 : Number(searchTerm) }, // Exact SKU match if numeric
      ];

      // If search term is a valid MongoDB ObjectId, add _id search
      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(searchTerm) });
      }

      and.push({ $or: searchConditions });
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

/**
 * Get all products with average rating from reviews (enhanced version)
 */
const getAllProductsEnhanced = async (params: {
  page?: number;
  limit?: number;
  category?: string;
  subcategory?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'name' | 'createdAt' | 'rating' | 'sales';
  sortOrder?: 'asc' | 'desc';
  availability?: 'in-stock' | 'out-of-stock' | 'low-stock';
  brand?: string;
  specKey?: string;
  specValue?: string;
}): Promise<
  CustomResponseTypeWithMeta<ProductType[], { total: number; page: number; limit: number; pages: number }>
> => {
  try {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const sortOrderNum = params.sortOrder === 'asc' ? 1 : -1;

    const match: Record<string, unknown> = {};
    const and: Array<Record<string, unknown>> = [];

    // Category filter
    if (params.category) {
      match.category = new mongoose.Types.ObjectId(params.category);
    }

    // Search filter
    if (params.search) {
      const searchTerm = params.search.trim();
      const rx = new RegExp(escapeRegex(searchTerm), 'i');

      // Build $or conditions for name, description, tags, sku, and _id
      const searchConditions: Record<string, unknown>[] = [
        { name: rx },
        { tags: { $in: [rx] } },
        { sku: isNaN(Number(searchTerm)) ? -1 : Number(searchTerm) }, // Exact SKU match if numeric
      ];

      // If search term is a valid MongoDB ObjectId, add _id search
      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(searchTerm) });
      }
      and.push({ $or: searchConditions });
    }

    // Price range
    if (params.minPrice != null || params.maxPrice != null) {
      const priceMatch: Record<string, unknown> = {};
      if (params.minPrice != null) priceMatch.$gte = params.minPrice;
      if (params.maxPrice != null) priceMatch.$lte = params.maxPrice;
      match.price = priceMatch;
    }

    // Availability filter
    if (params.availability) {
      if (params.availability === 'in-stock') match.stock = { $gt: 0 };
      else if (params.availability === 'out-of-stock') match.stock = 0;
      else if (params.availability === 'low-stock')
        and.push({ $expr: { $lte: ['$stock', '$lowStockThreshold'] }, stock: { $gt: 0 } });
    }

    // Specification filter
    if (params.specKey && params.specValue) {
      and.push({
        specifications: { $elemMatch: { key: params.specKey, value: new RegExp(escapeRegex(params.specValue), 'i') } },
      });
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

    // Add average rating from reviews
    pipeline.push(
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'product',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          totalRating: {
            $cond: {
              if: { $gt: [{ $size: '$reviews' }, 0] },
              then: { $avg: '$reviews.rating' },
              else: 0,
            },
          },
          reviewCount: { $size: '$reviews' },
        },
      },
      {
        $project: { reviews: 0 }, // Remove reviews array from response
      }
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
    else if (params.sortBy === 'rating') sortStage.totalRating = sortOrderNum;
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
                stock: 1,
                lowStockThreshold: 1,
                status: 1,
                totalRating: 1,
                reviewCount: 1,
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
                createdAt: 1,
                updatedAt: 1,
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
    console.error('Error fetching enhanced products:', error);
    return { message: 'Failed to fetch products', data: null, code: 500 };
  }
};

/**
 * Check if SKU exists
 */
const checkSkuExists = async (
  sku: number
): Promise<CustomResponseType<{ exists: boolean; productId?: string; productName?: string }>> => {
  try {
    const product = await Product.findOne({ sku }).select('_id name').lean().exec();

    if (product) {
      return {
        message: 'SKU exists',
        data: {
          exists: true,
          productId: product._id.toString(),
          productName: product.name,
        },
        code: 200,
      };
    }

    return {
      message: 'SKU available',
      data: { exists: false },
      code: 200,
    };
  } catch (error) {
    console.error('Error checking SKU:', error);
    return { message: 'Failed to check SKU', data: null, code: 500 };
  }
};

/**
 * Check if slug is available (not taken by another product)
 * @param slug - Product slug to check
 * @param excludeId - Optional product ID to exclude from check (for editing existing product)
 * @returns Response with available boolean and optional conflicting product info
 */
const checkSlugAvailable = async (
  slug: string,
  excludeId?: string
): Promise<CustomResponseType<{ available: boolean; productId?: string; productName?: string }>> => {
  try {
    const query: FilterQuery<ProductType> = { slug };

    // When editing, exclude the current product from the check
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const product = await Product.findOne(query).select('_id name').lean().exec();

    if (product) {
      return {
        message: 'Slug is already taken',
        data: {
          available: false,
          productId: product._id.toString(),
          productName: product.name,
        },
        code: 200,
      };
    }

    return {
      message: 'Slug is available',
      data: { available: true },
      code: 200,
    };
  } catch (error) {
    console.error('Error checking slug:', error);
    return { message: 'Failed to check slug', data: null, code: 500 };
  }
};

/**
 * Get minimal product list for dropdowns/selectors
 * Returns only essential fields for UI selectors
 */
const getProductListMinimal = async (): Promise<
  CustomResponseType<Array<{ _id: string; name: string; image: string; sku: number }>>
> => {
  try {
    const products = await Product.find({ status: 'active' })
      .select('_id name sku description_images.url description_images.cover_image')
      .sort({ name: 1 })
      .lean()
      .exec();

    const productList = products.map((product) => {
      // Find cover image or use first image
      const coverImage = product.description_images?.find((img) => img.cover_image);
      const imageUrl = coverImage?.url || product.description_images?.[0]?.url || '';

      return {
        _id: product._id.toString(),
        name: product.name,
        sku: product.sku,
        image: imageUrl,
      };
    });

    return {
      message: 'Product list retrieved successfully',
      data: productList,
      code: 200,
    };
  } catch (error) {
    console.error('Error getting minimal product list:', error);
    return { message: 'Failed to get product list', data: null, code: 500 };
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
  getAllProductsEnhanced,
  checkSkuExists,
  checkSlugAvailable,
  getProductListMinimal,
};

export default Admin_ProductService;
