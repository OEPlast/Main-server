import Sales, { SalesType } from '@/models/Sales';
import { Types } from 'mongoose';
import { CustomResponsePromise } from '@/types';

/**
 * Gets all active and not deleted sales for users (paginated).
 */
export const getAllActiveSales = async (
  page = 1,
  limit = 20
): CustomResponsePromise<{ sales: any[]; page: number; total: number }> => {
  try {
    const match = { isActive: true, deleted: { $ne: true } };
    const total = await Sales.countDocuments(match);
    const sales = await Sales.aggregate([
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
          limit: 1,
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
    ]);
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
export const getSaleById = async (id: string): CustomResponsePromise<any> => {
  try {
    const result = await Sales.aggregate([
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
          limit: 1,
          startDate: 1,
          endDate: 1,
          createdAt: 1,
          updatedAt: 1,
          product: '$productInfo',
          variants: 1,
        },
      },
    ]);
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
): CustomResponsePromise<{ sales: any[]; page: number; total: number }> => {
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
    const sales = await Sales.aggregate([
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
          limit: 1,
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
    ]);
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
): CustomResponsePromise<{ sales: any[]; page: number; total: number }> => {
  try {
    const match = {
      type: 'Limited',
      isActive: true,
      deleted: { $ne: true },
      limit: { $gte: 1 },
    };
    const total = await Sales.countDocuments(match);
    const sales = await Sales.aggregate([
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
          limit: 1,
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
    ]);
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
): CustomResponsePromise<{ sales: any[]; page: number; total: number }> => {
  try {
    const match = {
      type: 'Normal',
      isActive: true,
      deleted: { $ne: true },
    };
    const total = await Sales.countDocuments(match);
    const sales = await Sales.aggregate([
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
          limit: 1,
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
    ]);
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
export const isSaleAvailable = async (saleId: string, variantIndex?: number): CustomResponsePromise<any> => {
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
    // Limited: check limit
    if (sale.type === 'Limited' && sale.limit < 1) {
      await markSaleInactiveIfNeeded(sale);
      return {
        message: 'Limited sale limit reached',
        data: null,
        code: 400,
      };
    }
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
      const hasAvailable = sale.variants.some((v: any) => v.maxBuys === 0 || v.boughtCount < v.maxBuys);
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
export const markSaleInactiveIfNeeded = async (sale: any, variantIndex?: number) => {
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
    const allReached = sale.variants.every((v: any) => v.maxBuys > 0 && v.boughtCount >= v.maxBuys);
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
