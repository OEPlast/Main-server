//this is a service for category
import Category, { CategoryType } from '../models/Category';

// Define the response type
interface CustomResponseType<T> {
  message: string;
  data: T | null;
  code: number;
}

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

export const CategoryService = {
  getAllCategories,
};
