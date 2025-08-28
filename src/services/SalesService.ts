import Sales, { SalesType } from '@/models/Sales';
import { Types } from 'mongoose';
import { CustomResponsePromise } from '@/types';

// Shape of aggregated sale with product fields
interface AggregatedSale {
  _id: string;
  title?: string;
  type: SalesType['type'];
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  product: unknown; // Keep generic to avoid tight coupling; ideally define Product pick type
  variants: SalesType['variants'];
}

/**
 * Gets all active and not deleted sales for users (paginated).
 */
export const getAllActiveSales = async (
  page = 1,
  limit = 20
): CustomResponsePromise<{ sales: AggregatedSale[]; page: number; total: number }> => {
  try {
    const match = { isActive: true, deleted: { $ne: true } };
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
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          isActive: 1,
          startDate: 1,
          endDate: 1,
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
    return {
      message: 'Active sales retrieved successfully',
      data: {
        sales,
        page,
        total,
      },
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
 * Gets a sale by id for users (only if active and not deleted).
 */
export const getSaleById = async (id: string): CustomResponsePromise<AggregatedSale> => {
  try {
    const result = (await Sales.aggregate([
      { $match: { _id: new Types.ObjectId(id), isActive: true, deleted: { $ne: true } } },
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
          startDate: 1,
          endDate: 1,
          createdAt: 1,
          updatedAt: 1,
          product: '$productInfo',
          variants: 1,
        },
      },
    ])) as AggregatedSale[];
    if (!result[0]) {
      return {
        message: 'Sale not available',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Sale retrieved successfully',
      data: result[0],
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
 * Gets all active flash sales (type: 'Flash', current date in range, paginated).
 */
export const getAllActiveFlashSales = async (
  page = 1,
  limit = 20
): CustomResponsePromise<{ sales: AggregatedSale[]; page: number; total: number }> => {
  try {
    const now = new Date();
    const match = {
      type: 'Flash' as SalesType['type'],
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
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          isActive: 1,
          startDate: 1,
          endDate: 1,
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
    return {
      message: 'Active flash sales retrieved successfully',
      data: {
        sales,
        page,
        total,
      },
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
 * Gets all active limited sales (type: 'Limited', limit >= 1, paginated).
 */
export const getAllActiveLimitedSales = async (
  page = 1,
  limit = 20
): CustomResponsePromise<{ sales: AggregatedSale[]; page: number; total: number }> => {
  try {
    const baseMatch = { type: 'Limited' as SalesType['type'], isActive: true, deleted: { $ne: true } } as const;
    const countAgg = await Sales.aggregate([
      { $match: baseMatch },
      {
        $addFields: {
          hasAvailable: {
            $anyElementTrue: {
              $map: {
                input: '$variants',
                as: 'v',
                in: { $or: [{ $eq: ['$$v.maxBuys', 0] }, { $lt: ['$$v.boughtCount', '$$v.maxBuys'] }] },
              },
            },
          },
        },
      },
      { $match: { hasAvailable: true } },
      { $count: 'total' },
    ]);
    const total = countAgg[0]?.total || 0;
    const sales = (await Sales.aggregate([
      { $match: baseMatch },
      {
        $addFields: {
          hasAvailable: {
            $anyElementTrue: {
              $map: {
                input: '$variants',
                as: 'v',
                in: { $or: [{ $eq: ['$$v.maxBuys', 0] }, { $lt: ['$$v.boughtCount', '$$v.maxBuys'] }] },
              },
            },
          },
        },
      },
      { $match: { hasAvailable: true } },
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
          startDate: 1,
          endDate: 1,
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
    return {
      message: 'Active limited sales retrieved successfully',
      data: {
        sales,
        page,
        total,
      },
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
 * Gets all active normal sales (type: 'Normal', paginated).
 */
export const getAllActiveNormalSales = async (
  page = 1,
  limit = 20
): CustomResponsePromise<{ sales: AggregatedSale[]; page: number; total: number }> => {
  try {
    const match = {
      type: 'Normal' as SalesType['type'],
      isActive: true,
      deleted: { $ne: true },
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
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          isActive: 1,
          startDate: 1,
          endDate: 1,
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
    return {
      message: 'Active normal sales retrieved successfully',
      data: {
        sales,
        page,
        total,
      },
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
 * Checks if a sale (and optionally a variant) is available for use.
 */
export const isSaleAvailable = async (saleId: string, variantIndex?: number): CustomResponsePromise<SalesType> => {
  try {
    const sale = await Sales.findById(saleId);
    if (!sale || sale.deleted) {
      return {
        message: 'Sale not found',
        data: null,
        code: 404,
      };
    }
    // Check isActive
    if (!sale.isActive) {
      return {
        message: 'Sale is not active',
        data: null,
        code: 400,
      };
    }
    // Flash: check time window
    if (sale.type === 'Flash') {
      const now = new Date();
      if (!sale.startDate || !sale.endDate || sale.startDate > now || sale.endDate < now) {
        await markSaleInactiveIfNeeded(sale);
        return {
          message: 'Flash sale is not in active time window',
          data: null,
          code: 400,
        };
      }
    }
    // Limited: availability will be inferred from variants availability (below)
    // Variant checks
    if (typeof variantIndex === 'number') {
      const variant = sale.variants[variantIndex];
      if (!variant) {
        return {
          message: 'Variant not found',
          data: null,
          code: 404,
        };
      }
      if (variant.maxBuys > 0 && variant.boughtCount >= variant.maxBuys) {
        await markSaleInactiveIfNeeded(sale, variantIndex);
        return {
          message: 'Variant max buys reached',
          data: null,
          code: 400,
        };
      }
    }
    // If no variants, or variantIndex not provided, check if any variant is available
    if (Array.isArray(sale.variants) && sale.variants.length > 0 && typeof variantIndex !== 'number') {
      const hasAvailable = sale.variants.some((v) => v.maxBuys === 0 || v.boughtCount < v.maxBuys);
      if (!hasAvailable) {
        await markSaleInactiveIfNeeded(sale);
        return {
          message: 'All variants max buys reached',
          data: null,
          code: 400,
        };
      }
    }
    return {
      message: 'Sale is available',
      data: sale,
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
 * Marks a sale or its variant as inactive if maxBuys reached or other criteria.
 */
export const markSaleInactiveIfNeeded = async (sale: import('@/models/Sales').SalesDocument, variantIndex?: number) => {
  let updated = false;
  if (typeof variantIndex === 'number' && sale.variants[variantIndex]) {
    const variant = sale.variants[variantIndex]!;
    if (variant.maxBuys > 0 && variant.boughtCount >= variant.maxBuys) {
      sale.isActive = false;
      updated = true;
    }
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
  if (updated) {
    await sale.save();
  }
};

const User_SalesService = {
  getAllActiveSales,
  getAllActiveFlashSales,
  getAllActiveLimitedSales,
  getAllActiveNormalSales,
  getSaleById,
  isSaleAvailable,
};

export default User_SalesService;
