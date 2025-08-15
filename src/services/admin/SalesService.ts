import Sales, { SalesType } from '@/models/Sales';
import { Types } from 'mongoose';
import { CustomResponsePromise } from '@/types';

// Lightweight projection result types
interface AggregatedUserRef {
  _id: string;
  name: string;
  email: string;
}

interface AggregatedProductRef {
  _id: string;
  name?: string;
  // add other product fields as needed
  [key: string]: unknown;
}

export interface AggregatedSale {
  _id: string;
  title?: string;
  type: SalesType['type'];
  isActive: boolean;
  limit: number;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  product: AggregatedProductRef;
  createdBy?: AggregatedUserRef;
  variants?: SalesType['variants'];
  deleted?: boolean;
}

export type PaginatedSales = { sales: AggregatedSale[]; page: number; total: number };

/**
 * Creates a new sale.
 */
export const createSale = async (data: Partial<SalesType>): CustomResponsePromise<SalesType> => {
  try {
    const sale = await Sales.create(data);
    return { message: 'Sale created successfully', data: sale, code: 201 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Gets all sales with product and creator info (paginated).
 */
export const getAllSales = async (page = 1, limit = 20): CustomResponsePromise<PaginatedSales> => {
  try {
    const total = await Sales.countDocuments({});
    const sales = (await Sales.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: '$creator' },
      {
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          isActive: 1,
          limit: 1,
          startDate: 1,
          endDate: 1,
          createdAt: 1,
          updatedAt: 1,
          product: '$productInfo',
          createdBy: {
            _id: '$creator._id',
            name: { $concat: ['$creator.firstName', ' ', '$creator.lastName'] },
            email: '$creator.email',
          },
          variants: 1,
          deleted: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ])) as AggregatedSale[];

    return { message: 'Sales retrieved successfully', data: { sales, page, total }, code: 200 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Gets sale by id with product and creator info.
 */
export const getSaleById = async (id: string): CustomResponsePromise<AggregatedSale> => {
  try {
    const result = (await Sales.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: '$creator' },
      {
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          isActive: 1,
          limit: 1,
          startDate: 1,
          endDate: 1,
          deleted: 1,
          createdAt: 1,
          updatedAt: 1,
          product: '$productInfo',
          createdBy: {
            _id: '$creator._id',
            name: { $concat: ['$creator.firstName', ' ', '$creator.lastName'] },
            email: '$creator.email',
          },
          variants: 1,
        },
      },
    ])) as AggregatedSale[];

    const doc = result[0] || null;
    return { message: doc ? 'Sale retrieved successfully' : 'Sale not found', data: doc, code: doc ? 200 : 404 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Updates a sale.
 */
export const updateSale = async (id: string, data: Partial<SalesType>): CustomResponsePromise<SalesType> => {
  try {
    const sale = await Sales.findByIdAndUpdate(id, data, { new: true });
    return { message: sale ? 'Sale updated successfully' : 'Sale not found', data: sale, code: sale ? 200 : 404 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Deletes a sale.
 */
export const deleteSale = async (id: string): CustomResponsePromise<null> => {
  try {
    const sale = await Sales.findByIdAndDelete(id);
    return { message: sale ? 'Sale deleted successfully' : 'Sale not found', data: null, code: sale ? 200 : 404 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Gets sales by type with product info (paginated).
 */
export const getSalesByType = async (type: string, page = 1, limit = 20): CustomResponsePromise<PaginatedSales> => {
  try {
    const total = await Sales.countDocuments({ type });
    const sales = (await Sales.aggregate([
      { $match: { type } },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      {
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          isActive: 1,
          limit: 1,
          startDate: 1,
          endDate: 1,
          deleted: 1,
          createdAt: 1,
          updatedAt: 1,
          product: '$productInfo',
          variants: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ])) as AggregatedSale[];

    return { message: 'Sales retrieved successfully', data: { sales, page, total }, code: 200 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Updates a sale variant.
 */
export const updateSaleVariant = async (
  id: string,
  variantIndex: number,
  variantData: SalesType['variants'][number]
): CustomResponsePromise<SalesType> => {
  try {
    const sale = await Sales.findOneAndUpdate(
      { _id: id, [`variants.${variantIndex}`]: { $exists: true } },
      { $set: { [`variants.${variantIndex}`]: variantData } },
      { new: true }
    );
    return {
      message: sale ? 'Variant updated successfully' : 'Sale or variant not found',
      data: sale,
      code: sale ? 200 : 404,
    };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Deletes a sale variant.
 */
export const deleteSaleVariant = async (id: string, variantIndex: number): CustomResponsePromise<SalesType> => {
  try {
    const sale = await Sales.findOneAndUpdate(
      { _id: id, [`variants.${variantIndex}`]: { $exists: true } },
      { $unset: { [`variants.${variantIndex}`]: '' } },
      { new: true }
    );
    return {
      message: sale ? 'Variant deleted successfully' : 'Sale or variant not found',
      data: sale,
      code: sale ? 200 : 404,
    };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Gets sale usage info.
 */
export const getSaleUsage = async (
  id: string
): CustomResponsePromise<{
  limit: number;
  variants: Array<{ maxBuys: number; boughtCount: number }>;
  isActive: boolean;
  endDate?: Date | null;
}> => {
  try {
    const sale = await Sales.findById(id);
    if (!sale) return { message: 'Sale not found', data: null, code: 404 };

    return {
      message: 'Sale usage retrieved successfully',
      data: {
        limit: sale.limit,
        variants: (sale.variants || []).map((v) => ({ maxBuys: v.maxBuys, boughtCount: v.boughtCount })),
        isActive: sale.isActive,
        endDate: sale.endDate,
      },
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Decrements sale limit and variant buy count.
 */
export const decrementSaleLimit = async (id: string, variantIndex?: number): CustomResponsePromise<SalesType> => {
  try {
    const sale = await Sales.findById(id);
    if (!sale) return { message: 'Sale not found', data: null, code: 404 };
    if (!sale.isActive) return { message: 'Sale is not active', data: null, code: 400 };
    if (sale.endDate && sale.endDate < new Date()) {
      sale.isActive = false;
      await sale.save();
      return { message: 'Sale has ended', data: null, code: 400 };
    }
    if (sale.limit <= 0) {
      sale.isActive = false;
      await sale.save();
      return { message: 'Sale limit reached', data: null, code: 400 };
    }
    if (typeof variantIndex === 'number') {
      const variant = sale.variants[variantIndex];
      if (!variant) return { message: 'Variant not found', data: null, code: 404 };
      if (variant.maxBuys > 0 && variant.boughtCount >= variant.maxBuys)
        return { message: 'Variant max buys reached', data: null, code: 400 };
      variant.boughtCount += 1;
    }
    sale.limit -= 1;
    if (sale.limit <= 0) sale.isActive = false;
    await sale.save();
    return { message: 'Sale decremented successfully', data: sale, code: 200 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Checks sale on checkout.
 */
export const checkSaleOnCheckout = async (saleId: string, variantIndex?: number): CustomResponsePromise<SalesType> => {
  try {
    const sale = await Sales.findById(saleId);
    if (!sale) return { message: 'Sale not found', data: null, code: 404 };
    if (!sale.isActive) return { message: 'Sale is not active', data: null, code: 400 };
    if (sale.endDate && sale.endDate < new Date()) return { message: 'Sale has ended', data: null, code: 400 };
    if (sale.limit <= 0) return { message: 'Sale limit reached', data: null, code: 400 };

    if (typeof variantIndex === 'number') {
      const variant = sale.variants[variantIndex];
      if (!variant) return { message: 'Variant not found', data: null, code: 404 };
      if (variant.maxBuys > 0 && variant.boughtCount >= variant.maxBuys)
        return { message: 'Variant max buys reached', data: null, code: 400 };
    }

    return { message: 'Sale is valid for checkout', data: sale, code: 200 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Gets all active flash sales (type: 'Flash', current date in range, paginated).
 */
export const getAllActiveFlashSales = async (page = 1, limit = 20): CustomResponsePromise<PaginatedSales> => {
  try {
    const now = new Date();
    const match = {
      type: 'Flash',
      isActive: true,
      deleted: { $ne: true },
      startDate: { $lte: now },
      endDate: { $gte: now },
    };
    const total = await Sales.countDocuments(match);
    const sales = (await Sales.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: '$creator' },
      {
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          isActive: 1,
          limit: 1,
          startDate: 1,
          endDate: 1,
          createdAt: 1,
          updatedAt: 1,
          product: '$productInfo',
          createdBy: {
            _id: '$creator._id',
            name: { $concat: ['$creator.firstName', ' ', '$creator.lastName'] },
            email: '$creator.email',
          },
          variants: 1,
          deleted: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ])) as AggregatedSale[];

    return { message: 'Active flash sales retrieved successfully', data: { sales, page, total }, code: 200 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Gets all active limited sales (type: 'Limited', limit >= 1, paginated).
 */
export const getAllActiveLimitedSales = async (page = 1, limit = 20): CustomResponsePromise<PaginatedSales> => {
  try {
    const match = { type: 'Limited', isActive: true, deleted: { $ne: true }, limit: { $gte: 1 } };
    const total = await Sales.countDocuments(match);
    const sales = (await Sales.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: '$creator' },
      {
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          isActive: 1,
          limit: 1,
          startDate: 1,
          endDate: 1,
          createdAt: 1,
          updatedAt: 1,
          product: '$productInfo',
          createdBy: {
            _id: '$creator._id',
            name: { $concat: ['$creator.firstName', ' ', '$creator.lastName'] },
            email: '$creator.email',
          },
          variants: 1,
          deleted: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ])) as AggregatedSale[];

    return { message: 'Active limited sales retrieved successfully', data: { sales, page, total }, code: 200 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Gets all active normal sales (type: 'Normal', paginated).
 */
export const getAllActiveNormalSales = async (page = 1, limit = 20): CustomResponsePromise<PaginatedSales> => {
  try {
    const match = { type: 'Normal', isActive: true, deleted: { $ne: true } };
    const total = await Sales.countDocuments(match);
    const sales = (await Sales.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: '$creator' },
      {
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          isActive: 1,
          limit: 1,
          startDate: 1,
          endDate: 1,
          createdAt: 1,
          updatedAt: 1,
          product: '$productInfo',
          createdBy: {
            _id: '$creator._id',
            name: { $concat: ['$creator.firstName', ' ', '$creator.lastName'] },
            email: '$creator.email',
          },
          variants: 1,
          deleted: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ])) as AggregatedSale[];

    return { message: 'Active normal sales retrieved successfully', data: { sales, page, total }, code: 200 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Checks if a sale (and optionally a variant) is available for use (admin).
 */
export const isSaleAvailable = async (saleId: string, variantIndex?: number): CustomResponsePromise<SalesType> => {
  try {
    const sale = await Sales.findById(saleId);
    if (!sale || sale.deleted) return { message: 'Sale not found', data: null, code: 404 };
    if (!sale.isActive) return { message: 'Sale is not active', data: null, code: 400 };

    if (sale.type === 'Flash') {
      const now = new Date();
      if (!sale.startDate || !sale.endDate || sale.startDate > now || sale.endDate < now) {
        await markSaleInactiveIfNeeded(sale);
        return { message: 'Flash sale is not in active time window', data: null, code: 400 };
      }
    }

    if (sale.type === 'Limited' && sale.limit < 1) {
      await markSaleInactiveIfNeeded(sale);
      return { message: 'Limited sale limit reached', data: null, code: 400 };
    }

    if (typeof variantIndex === 'number') {
      const variant = sale.variants[variantIndex];
      if (!variant) return { message: 'Variant not found', data: null, code: 404 };
      if (variant.maxBuys > 0 && variant.boughtCount >= variant.maxBuys)
        return { message: 'Variant max buys reached', data: null, code: 400 };
    }

    if (Array.isArray(sale.variants) && sale.variants.length > 0 && typeof variantIndex !== 'number') {
      const hasAvailable = sale.variants.some((v) => v.maxBuys === 0 || v.boughtCount < v.maxBuys);
      if (!hasAvailable) {
        await markSaleInactiveIfNeeded(sale);
        return { message: 'All variants max buys reached', data: null, code: 400 };
      }
    }

    return { message: 'Sale is available', data: sale, code: 200 };
  } catch (error) {
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Marks a sale or its variant as inactive if maxBuys reached or other criteria.
 */
export const markSaleInactiveIfNeeded = async (
  sale: SalesType & { save: () => Promise<unknown> },
  variantIndex?: number
) => {
  let updated = false;

  if (typeof variantIndex === 'number' && sale.variants[variantIndex]) {
    const variant = sale.variants[variantIndex];
    if (variant.maxBuys > 0 && variant.boughtCount >= variant.maxBuys) {
      sale.isActive = false;
      updated = true;
    }
  } else if (sale.type === 'Limited' && sale.limit < 1) {
    sale.isActive = false;
    updated = true;
  } else if (sale.type === 'Flash') {
    const now = new Date();
    if (!sale.startDate || !sale.endDate || sale.startDate > now || sale.endDate < now) {
      sale.isActive = false;
      updated = true;
    }
  } else if (Array.isArray(sale.variants) && sale.variants.length > 0) {
    const allReached = sale.variants.every((v) => v.maxBuys > 0 && v.boughtCount >= v.maxBuys);
    if (allReached) {
      sale.isActive = false;
      updated = true;
    }
  }

  if (updated) await sale.save();
};

const Admin_SalesService = {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  getSalesByType,
  updateSaleVariant,
  getSaleUsage,
  decrementSaleLimit,
  checkSaleOnCheckout,
  getAllActiveFlashSales,
  getAllActiveLimitedSales,
  getAllActiveNormalSales,
  isSaleAvailable,
  markSaleInactiveIfNeeded,
};

export default Admin_SalesService;
