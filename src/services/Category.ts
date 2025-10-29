//this is a service for category
import { CustomResponseTypeWithMeta } from '@/types';
import Category, { CategoryType } from '../models/Category';
import mongoose, { PipelineStage } from 'mongoose';

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
};
