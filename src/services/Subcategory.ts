import { CustomResponseType } from '@/types';
import SubCategory, { SubcategoryType } from '../models/SubCategory';
import { ObjectId } from 'mongodb';

/**
 * Creates a new subcategory.
 * @param name - The name of the subcategory.
 * @param categoryId - The ID of the category to which the subcategory belongs.
 * @returns A promise that resolves to a custom response containing the created subcategory.
 */
const createSubCategory = async (name: string, categoryId: string): Promise<CustomResponseType<SubcategoryType>> => {
  try {
    const subCategory = new SubCategory({ name, category: new ObjectId(categoryId) });
    await subCategory.save();
    return {
      message: 'SubCategory created successfully',
      data: subCategory,
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

/**
 * Updates a subcategory.
 * @param id - The ID of the subcategory to update.
 * @param name - The new name of the subcategory.
 * @returns A promise that resolves to a custom response containing the updated subcategory.
 */
const updateSubCategory = async (id: string, name: string): Promise<CustomResponseType<SubcategoryType>> => {
  try {
    const subCategory = await SubCategory.findByIdAndUpdate(id, { name }, { new: true });
    return {
      message: 'SubCategory updated successfully',
      data: subCategory,
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
 * Deletes a subcategory.
 * @param id - The ID of the subcategory to delete.
 * @returns A promise that resolves to a custom response indicating the deletion status.
 */
const deleteSubCategory = async (id: string): Promise<CustomResponseType<void>> => {
  try {
    await SubCategory.findByIdAndDelete(id);
    return {
      message: 'SubCategory deleted successfully',
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

export const SubCategoryService = {
  createSubCategory,
  getAllSubCategories,
  updateSubCategory,
  deleteSubCategory,
};
