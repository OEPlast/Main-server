import Attribute, { AttributeType } from '@/models/Attributes';
import { CustomResponseType } from '@/types';

/**
 * Creates a new attribute.
 * @param data - The data for the new attribute.
 * @returns A promise that resolves to a custom response containing the created attribute.
 */
const createAttribute = async ({
  name,
  children,
}: {
  name: string;
  children: { name: string; image: string }[];
}): Promise<CustomResponseType<AttributeType>> => {
  try {
    const attribute = new Attribute({ name, children });
    await attribute.save();
    return { message: 'Attribute created successfully', data: attribute, code: 201 };
  } catch (error) {
    console.error('Error creating attribute:', error);
    return { message: 'Failed to create attribute', data: null, code: 500 };
  }
};

/**
 * Retrieves all attributes.
 * @returns A promise that resolves to a custom response containing all attributes.
 */
const allAttributes = async (): Promise<CustomResponseType<AttributeType[]>> => {
  try {
    const attributes = await Attribute.find();
    return { message: 'Attributes retrieved successfully', data: attributes, code: 200 };
  } catch (error) {
    console.error('Error fetching attributes:', error);
    return { message: 'Failed to fetch attributes', data: null, code: 500 };
  }
};

/**
 * Retrieves an attribute by its ID.
 * @param id - The ID of the attribute to retrieve.
 * @returns A promise that resolves to a custom response containing the attribute.
 */
const oneAttribute = async (id: string): Promise<CustomResponseType<AttributeType>> => {
  try {
    const attribute = await Attribute.findById(id);
    if (!attribute) {
      return { message: 'Attribute not found', data: null, code: 404 };
    }
    return { message: 'Attribute retrieved successfully', data: attribute, code: 200 };
  } catch (error) {
    console.error('Error fetching attribute by ID:', error);
    return { message: 'Failed to fetch attribute', data: null, code: 500 };
  }
};

/**
 * Updates an attribute.
 * @param id - The ID of the attribute to update.
 * @param data - The updated data for the attribute.
 * @returns A promise that resolves to a custom response containing the updated attribute.
 */
const updateAttribute = async ({
  id,
  data,
}: {
  id: string;
  data: { name?: string; children?: { name: string; image: string }[] };
}): Promise<CustomResponseType<AttributeType>> => {
  try {
    const attribute = await Attribute.findByIdAndUpdate(id, data);
    if (!attribute) {
      return { message: 'Attribute not found', data: null, code: 404 };
    }
    return { message: 'Attribute updated successfully', data: attribute, code: 200 };
  } catch (error) {
    console.error('Error updating attribute:', error);
    return { message: 'Failed to update attribute', data: null, code: 500 };
  }
};

/**
 * Deletes an attribute.
 * @param id - The ID of the attribute to delete.
 * @returns A promise that resolves to a custom response confirming the deletion.
 */
const deleteAttribute = async (id: string): Promise<CustomResponseType<null>> => {
  try {
    const attribute = await Attribute.findByIdAndDelete(id);
    if (!attribute) {
      return { message: 'Attribute not found', data: null, code: 404 };
    }
    return { message: 'Attribute deleted successfully', data: null, code: 200 };
  } catch (error) {
    console.error('Error deleting attribute:', error);
    return { message: 'Failed to delete attribute', data: null, code: 500 };
  }
};

export default {
  createAttribute,
  allAttributes,
  oneAttribute,
  updateAttribute,
  deleteAttribute,
};
