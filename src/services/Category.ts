//this is a service for category
import { CustomResponseTypeWithMeta } from '@/types';
import Category, { CategoryType } from '../models/Category';
import mongoose, { PipelineStage } from 'mongoose';
import Product from '../models/Product';

type CategoryWithSubs = CategoryType & {
  sub_categories: Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    image: string;
    slug?: string;
  }>;
};
/**
 * Retrieves all categories.
 * @returns A promise that resolves to a custom response containing an array of categories.
 */
const getAllCategories = async (): Promise<CustomResponseTypeWithMeta<CategoryWithSubs[], { total: number }>> => {
  try {
    const pipeline: PipelineStage[] = [
      {
        $match: { priority: true },
      },
      { $sort: { name: 1, createdAt: -1 } },
      {
        $facet: {
          data: [
            {
              $lookup: {
                from: 'categories', // self lookup for sub categories
                localField: '_id',
                foreignField: 'parent',
                as: 'sub_categories',
              },
            },
            {
              $project: {
                name: 1,
                banner: 1,
                image: 1,
                slug: 1,
                sub_categories: {
                  $map: {
                    input: '$sub_categories',
                    as: 'sc',
                    in: {
                      _id: '$$sc._id',
                      name: '$$sc.name',
                      image: '$$sc.image',
                      slug: '$$sc.slug',
                    },
                  },
                },
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      },
    ];

    const aggResult: Array<{ data: CategoryWithSubs[]; total: number }> = await Category.aggregate(pipeline);
    const categories = (aggResult[0]?.data as CategoryWithSubs[]) || [];
    const total = (aggResult[0]?.total as number) || 0;

    return {
      message: 'Categories retrieved successfully',
      data: categories,
      code: 200,
      meta: { total },
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

const getCategoryById = async (categoryId: string): CustomResponseTypeWithMeta<CategoryWithSubs> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return { message: 'Invalid category id', data: null, code: 400 };
    }

    const pipeline: PipelineStage[] = [
      { $match: { _id: new mongoose.Types.ObjectId(categoryId) } },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: 'parent',
          as: 'sub_categories',
        },
      },
      {
        $addFields: {
          sub_categories: {
            $map: {
              input: '$sub_categories',
              as: 'sc',
              in: {
                _id: '$$sc._id',
                name: '$$sc.name',
                image: '$$sc.image',
                slug: '$$sc.slug',
                banner: '$$sc.banner',
                description: '$$sc.description',
                priority: '$$sc.priority',
              },
            },
          },
          subcategoryCount: { $size: '$sub_categories' },
        },
      },
      {
        $project: {
          name: 1,
          banner: 1,
          image: 1,
          slug: 1,
          description: 1,
          parent: 1,
          priority: 1,
          createdAt: 1,
          updatedAt: 1,
          sub_categories: 1,
          subcategoryCount: 1,
        },
      },
    ];

    const aggResult: CategoryWithSubs[] = await Category.aggregate(pipeline);
    const category = aggResult[0] || null;
    if (!category) {
      return { message: 'Category not found', data: null, code: 404 };
    }
    return { message: 'Category retrieved successfully', data: category, code: 200 };
  } catch (error) {
    console.log(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};
export const CategoryService = {
  getAllCategories,
  getCategoryById,
  async getCategoryBySlug(slug: string): CustomResponseTypeWithMeta<CategoryWithSubs> {
    try {
      const pipeline: PipelineStage[] = [
        { $match: { slug } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: 'parent',
            as: 'sub_categories',
          },
        },
        {
          $addFields: {
            sub_categories: {
              $map: {
                input: '$sub_categories',
                as: 'sc',
                in: {
                  _id: '$$sc._id',
                  name: '$$sc.name',
                  image: '$$sc.image',
                  slug: '$$sc.slug',
                },
              },
            },
          },
        },
        {
          $project: {
            name: 1,
            banner: 1,
            image: 1,
            slug: 1,
            sub_categories: 1,
            description: 1,
          },
        },
      ];

      const aggResult: CategoryWithSubs[] = await Category.aggregate(pipeline);
      const category = aggResult[0] || null;
      if (!category) {
        return { message: 'Category not found', data: null, code: 404 };
      }
      return { message: 'Category retrieved successfully', data: category, code: 200 };
    } catch (error) {
      console.error('getCategoryBySlug error:', error);
      return { message: 'Something went wrong', data: null, code: 500 };
    }
  },
  async getCategoryFilters(slug: string): CustomResponseTypeWithMeta<{
    priceRange: { min: number; max: number };
    attributes: Array<{ name: string; values: Array<{ value: string; count: number; colorCode?: string }> }>;
    specifications: Array<{ key: string; values: Array<{ value: string; count: number }> }>;
    tags: Array<{ value: string; count: number }>;
    packSizes: Array<{ label: string; count: number }>;
  }> {
    try {
      // Build category tree (base + direct subcategories) and collect product-level filters
      const cat = await Category.findOne({ slug }).select('_id');
      if (!cat) return { message: 'Category not found', data: null, code: 404 };

      const subs = await Category.find({ parent: { $elemMatch: { $eq: cat._id } } }).select('_id');
      const categoryIds = [cat._id, ...subs.map((s) => s._id)];

      const pipeline: PipelineStage[] = [
        { $match: { category: { $in: categoryIds }, status: 'active' } },
        // Price range
        {
          $facet: {
            price: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],
            // Attributes aggregation
            attributes: [
              { $unwind: { path: '$attributes', preserveNullAndEmptyArrays: false } },
              { $unwind: { path: '$attributes.children', preserveNullAndEmptyArrays: false } },
              {
                $group: {
                  _id: { name: '$attributes.name', value: '$attributes.children.name' },
                  count: { $sum: 1 },
                  colorCode: { $first: '$attributes.children.colorCode' },
                },
              },
              {
                $group: {
                  _id: '$_id.name',
                  values: {
                    $push: { value: '$_id.value', count: '$count', colorCode: '$colorCode' },
                  },
                },
              },
              { $project: { _id: 0, name: '$_id', values: 1 } },
            ],
            // Specifications aggregation
            specifications: [
              { $unwind: { path: '$specifications', preserveNullAndEmptyArrays: false } },
              {
                $group: {
                  _id: { key: '$specifications.key', value: '$specifications.value' },
                  count: { $sum: 1 },
                },
              },
              {
                $group: {
                  _id: '$_id.key',
                  values: { $push: { value: '$_id.value', count: '$count' } },
                },
              },
              { $project: { _id: 0, key: '$_id', values: 1 } },
            ],
            // Tags aggregation
            tags: [
              { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
              { $group: { _id: '$tags', count: { $sum: 1 } } },
              { $project: { _id: 0, value: '$_id', count: 1 } },
            ],
            // Pack sizes
            packSizes: [
              { $unwind: { path: '$packSizes', preserveNullAndEmptyArrays: false } },
              { $group: { _id: '$packSizes.label', count: { $sum: 1 } } },
              { $project: { _id: 0, label: '$_id', count: 1 } },
            ],
          },
        },
        {
          $project: {
            priceRange: {
              min: { $ifNull: [{ $arrayElemAt: ['$price.min', 0] }, 0] },
              max: { $ifNull: [{ $arrayElemAt: ['$price.max', 0] }, 0] },
            },
            attributes: 1,
            specifications: 1,
            tags: 1,
            packSizes: 1,
          },
        },
      ];

      // Use Product collection for filters
      const agg = await Product.aggregate(pipeline).allowDiskUse(true);
      const payload = agg[0] || {
        priceRange: { min: 0, max: 0 },
        attributes: [],
        specifications: [],
        tags: [],
        packSizes: [],
      };
      return { message: 'Filters retrieved successfully', data: payload, code: 200 };
    } catch (error) {
      console.error('Error building category filters:', error);
      return { message: 'Something went wrong', data: null, code: 500 };
    }
  },
};
