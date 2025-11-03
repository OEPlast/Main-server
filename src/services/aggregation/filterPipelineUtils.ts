import { PipelineStage } from 'mongoose';
import mongoose from 'mongoose';

export const buildPriceFilter = (minPrice?: number, maxPrice?: number): PipelineStage | null => {
  const cond: Record<string, number> = {};
  if (typeof minPrice === 'number') cond.$gte = minPrice;
  if (typeof maxPrice === 'number') cond.$lte = maxPrice;
  if (Object.keys(cond).length === 0) return null;
  return { $match: { price: cond } };
};

export const buildAttributeFilter = (attributeFilters?: Record<string, string | string[]>): PipelineStage | null => {
  if (!attributeFilters || Object.keys(attributeFilters).length === 0) return null;
  const andExpr: unknown[] = Object.entries(attributeFilters).map(([attrName, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return {
      $anyElementTrue: {
        $map: {
          input: '$attributes',
          as: 'attr',
          in: {
            $and: [
              { $eq: ['$$attr.name', attrName] },
              {
                $anyElementTrue: {
                  $map: {
                    input: '$$attr.children',
                    as: 'child',
                    in: { $in: ['$$child.name', values] },
                  },
                },
              },
            ],
          },
        },
      },
    };
  });
  return { $match: { $expr: { $and: andExpr } } } as PipelineStage;
};

export const buildCategoryFilter = (categoryIds: string | mongoose.Types.ObjectId[]): PipelineStage => {
  const value = typeof categoryIds === 'string' ? categoryIds : categoryIds;
  return {
    $match: {
      $expr: {
        $and: [{ $in: ['$category', value as unknown] }, { $eq: ['$status', 'active'] }],
      },
    },
  } as PipelineStage;
};

export const buildTagsFilter = (tags?: string[]): PipelineStage | null => {
  if (!tags || tags.length === 0) return null;
  return { $match: { tags: { $in: tags } } };
};
