//this is a service for category
import { CustomResponsePromise, CustomResponseTypeWithMeta } from '@/types';
import Category, { CategoryType } from '../../models/Category';
import mongoose, { PipelineStage } from 'mongoose';

/**
 * Creates a new category.
 * @param name - The name of the category.
 * @param slug - The slug of the category.
 * @returns A promise that resolves to a custom response containing the created category.
 */
const createCategory = async ({
  name,
  banner,
  description,
  parent,
}: {
  name: string;
  banner?: string;
  parent: string[];
  description?: string;
}): CustomResponseTypeWithMeta<CategoryType> => {
  try {
    const slug = name.trim().replace(/\s+/g, '_');
    const category = new Category({ name, slug, banner, description, parent });
    await category.save();
    return {
      message: 'Category created successfully',
      data: category,
      code: 200,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('11000')) {
        return {
          message: 'Category name already exist',
          data: null,
          code: 400,
        };
      }
    }
    console.log(error);

    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Retrieves all categories.
 * @returns A promise that resolves to a custom response containing an array of categories.
 */
type CategoryListItem = Pick<CategoryType, 'name' | 'image' | 'banner' | 'slug' | 'description' | 'parent'> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  subcategoryCount: number;
};

const getAllCategories = async ({
  page = 1,
  limit = 20,
}: {
  page?: number;
  limit?: number;
} = {}): Promise<
  CustomResponseTypeWithMeta<CategoryListItem[], { page: number; limit: number; total: number; pages: number }>
> => {
  try {
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'categories',
                let: { catId: '$_id' },
                pipeline: [{ $match: { $expr: { $in: ['$$catId', '$parent'] } } }, { $count: 'count' }],
                as: 'sub_counts',
              },
            },
            {
              $addFields: {
                subcategoryCount: { $ifNull: [{ $arrayElemAt: ['$sub_counts.count', 0] }, 0] },
              },
            },
            {
              $project: {
                name: 1,
                banner: 1,
                image: 1,
                slug: 1,
                description: 1,
                priority: 1,
                parent: 1,
                createdAt: 1,
                updatedAt: 1,
                subcategoryCount: 1,
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

    const aggResult: Array<{ data: CategoryListItem[]; total: number }> = await Category.aggregate(pipeline);
    const categories = (aggResult[0]?.data as CategoryListItem[]) || [];
    const total = (aggResult[0]?.total as number) || 0;

    return {
      message: 'Categories retrieved successfully',
      data: categories,
      code: 200,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
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

/**
 * Retrieves all categories list (for dropdowns/select options)
 * Returns only _id, name, and slug - no pagination
 */
type CategoryListOption = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string;
};

const getCategoriesListAll = async (): CustomResponseTypeWithMeta<CategoryListOption[]> => {
  try {
    const categories = await Category.find({}, '_id name slug').sort({ name: 1 });
    return {
      message: 'Categories list retrieved successfully',
      data: categories as CategoryListOption[],
      code: 200,
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

/**
 * Retrieves a single category with its populated subcategories.
 */

type CategoryWithSubs = CategoryType & {
  sub_categories: Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    image: string;
    slug?: string;
  }>;
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
        $lookup: {
          from: 'categories',
          foreignField: '_id',
          localField: 'parent',
          as: 'parent_categories',
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
              },
            },
          },
          subcategoryCount: { $size: '$sub_categories' },
          parent_categories: {
            $map: {
              input: '$parent_categories',
              as: 'pc',
              in: {
                _id: '$$pc._id',
                name: '$$pc.name',
                image: '$$pc.image',
                slug: '$$pc.slug',
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
          description: 1,
          parent: 1,
          createdAt: 1,
          updatedAt: 1,
          sub_categories: 1,
          parent_categories: 1,
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

/**
 * Updates a category.
 * @param categoryId - The ID of the category to update.
 * @param name - The new name of the category.
 * @param slug - The new slug of the category.
 * @returns A promise that resolves to a custom response containing the updated category.
 */
const updateCategory = async ({
  categoryId,
  name,
  banner,
  parent,
  description,
  image,
  slug,
}: {
  categoryId: string;
  name?: string;
  banner?: string;
  description?: string;
  image?: string;
  slug?: string;
  parent: mongoose.Types.ObjectId[];
}): CustomResponseTypeWithMeta<CategoryType> => {
  try {
    if (!categoryId) {
      return {
        message: 'categoryId must be provided',
        data: null,
        code: 404,
      };
    }
    const updatePayload: Partial<CategoryType> & { slug?: string; banner?: string } = {};
    if (name) {
      updatePayload.name = name;
    }
    if (image) updatePayload.image = image;
    if (slug) updatePayload.slug = slug;
    if (banner) updatePayload.banner = banner;
    if (description) updatePayload.description = description;
    if (parent) {
      updatePayload.parent = parent;
    }

    const category = await Category.findByIdAndUpdate(categoryId, updatePayload, { new: true });
    return {
      message: 'Category updated successfully',
      data: category,
      code: 200,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('11000')) {
        return {
          message: 'Category name already exist',
          data: null,
          code: 400,
        };
      }
    }
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a category.
 * @param categoryId - The ID of the category to delete.
 * @returns A promise that resolves to a custom response indicating the deletion status.
 */
const deleteCategory = async (categoryId: string): CustomResponsePromise<null> => {
  try {
    const deleteCategoryFun = await Category.deleteOne({ _id: categoryId });

    if (deleteCategoryFun.deletedCount > 0) {
      //there was something to delete
      await Category.updateMany(
        {
          parent: categoryId,
        },
        {
          $pull: { parent: categoryId },
        }
      );
      return {
        message: 'Category deleted successfully',
        data: null,
        code: 200,
      };
    } else {
      return {
        message: 'Category not found',
        data: null,
        code: 400,
      };
    }
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

export const Admin_CategoryService = {
  createCategory,
  getAllCategories,
  getCategoriesListAll,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
