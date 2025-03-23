import { CustomResponseType } from '@/types';
import SubCategory, { SubcategoryType } from '../models/SubCategory';

/**
 * Retrieves all subcategories.
 * @returns A promise that resolves to a custom response containing an array of subcategories.
 */
const getAllSubCategories = async (): Promise<CustomResponseType<SubcategoryType[]>> => {
  try {
    const subCategories = await SubCategory.find().populate('category');
    return {
      message: 'SubCategories retrieved successfully',
      data: subCategories,
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

export const SubCategoryService = {
  getAllSubCategories,
};
