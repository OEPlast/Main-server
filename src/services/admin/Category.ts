//this is a service for category
import SubCategory from '@/models/SubCategory';
import Category, { CategoryType } from '../../models/Category';

// Define the response type
interface CustomResponseType<T> {
  message: string;
  data: T | null;
  code: number;
}

/**
 * Creates a new category.
 * @param name - The name of the category.
 * @param slug - The slug of the category.
 * @returns A promise that resolves to a custom response containing the created category.
 */
const createCategory = async ({
  name,
  slug,
}: {
  name: string;
  slug: string;
}): Promise<CustomResponseType<CategoryType>> => {
  try {
    const category = new Category({ name, slug });
    await category.save();
    return {
      message: 'Category created successfully',
      data: category,
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
 * Retrieves all categories.
 * @returns A promise that resolves to a custom response containing an array of categories.
 */
const getAllCategories = async (): Promise<CustomResponseType<CategoryType[]>> => {
  try {
    const categories = await Category.find().populate({ path: 'sub_categories', select: 'image name slug' });
    return {
      message: 'Categories retrieved successfully',
      data: categories,
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
 * Updates a category.
 * @param categoryId - The ID of the category to update.
 * @param name - The new name of the category.
 * @param slug - The new slug of the category.
 * @returns A promise that resolves to a custom response containing the updated category.
 */
const updateCategory = async ({
  categoryId,
  name,
  slug,
}: {
  categoryId: string;
  name: string;
  slug: string;
}): Promise<CustomResponseType<CategoryType>> => {
  try {
    if (!categoryId) {
      return {
        message: 'categoryId must be provided',
        data: null,
        code: 404,
      };
    }
    const category = await Category.findByIdAndUpdate(categoryId, { name, slug }, { new: true });
    return {
      message: 'Category updated successfully',
      data: category,
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
 * Deletes a category.
 * @param categoryId - The ID of the category to delete.
 * @returns A promise that resolves to a custom response indicating the deletion status.
 */
const deleteCategory = async (categoryId: string): Promise<CustomResponseType<null>> => {
  try {
    if (!categoryId) {
      return {
        message: 'categoryId must be provided',
        data: null,
        code: 404,
      };
    }

    await Promise.all([(Category.findByIdAndDelete(categoryId), SubCategory.deleteMany({ parent: categoryId }))]);

    return {
      message: 'Category deleted successfully',
      data: null,
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

export const Admin_CategoryService = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};
