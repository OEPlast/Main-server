import { PipelineStage } from 'mongoose';

/**
 * Get category and immediate subcategory IDs for a given category slug.
 * Returns stages that build an array `allCategoryIds` containing the base category
 * and its direct children. Extend to deeper trees as needed.
 */
export const buildCategoryTreeStages = (categorySlug: string): PipelineStage[] => [
  { $match: { slug: categorySlug } },
  {
    $lookup: {
      from: 'categories',
      localField: '_id',
      foreignField: 'parent',
      as: 'subcategories',
    },
  },
  {
    $addFields: {
      allCategoryIds: {
        $concatArrays: [
          ['$_id'],
          {
            $map: {
              input: '$subcategories',
              as: 'sc',
              in: '$$sc._id',
            },
          },
        ],
      },
    },
  },
];

/**
 * Lookup subcategories with product counts (active products only)
 */
export const lookupSubcategoriesWithCounts = (): PipelineStage => ({
  $lookup: {
    from: 'products',
    let: { subCategoryIds: '$subcategories._id' },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [{ $in: ['$category', '$$subCategoryIds'] }, { $eq: ['$status', 'active'] }],
          },
        },
      },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ],
    as: 'subcategoryProductCounts',
  },
});

/**
 * Merge counts into `sub_categories` array shape expected by frontend
 */
export const mergeSubcategoryProductCounts = (): PipelineStage => ({
  $addFields: {
    sub_categories: {
      $map: {
        input: '$subcategories',
        as: 'sub',
        in: {
          _id: '$$sub._id',
          name: '$$sub.name',
          slug: '$$sub.slug',
          image: '$$sub.image',
          productCount: {
            $let: {
              vars: {
                match: {
                  $first: {
                    $filter: {
                      input: '$subcategoryProductCounts',
                      as: 'cnt',
                      cond: { $eq: ['$$cnt._id', '$$sub._id'] },
                    },
                  },
                },
              },
              in: { $ifNull: ['$$match.count', 0] },
            },
          },
        },
      },
    },
  },
});
