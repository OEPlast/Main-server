import { duplicateMessage, isDuplicateKeyError } from '@/middleware/mongodb';
import Attribute, { AttributeType } from '@/models/Attributes';
import { CustomResponseType } from '@/types';

/**
 * Creates a new attribute.
 * @param data - The data for the new attribute.
 * @returns A promise that resolves to a custom response containing the created attribute.
 */
const createAttribute = async ({
  name,
  children = [],
}: {
  name: string;
  children: { name: string; image: string }[];
}): Promise<CustomResponseType<AttributeType>> => {
  try {
    const attribute = new Attribute({ name, children });
    await attribute.save();
    return { message: 'Attribute created successfully', data: attribute, code: 201 };
  } catch (error) {
    console.log(error);

    if (isDuplicateKeyError(error)) {
      return { message: duplicateMessage(error, 'Attribute'), data: null, code: 400 };
    }
    console.error('Error creating attribute:', error);
    return { message: 'Failed to create attribute', data: null, code: 500 };
  }
};

/**
 * Retrieves all attributes.
 * @returns A promise that resolves to a custom response containing all attributes.
 */
const allAttributes = async ({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}): Promise<
  CustomResponseType<AttributeType[]> & { meta: { page: number; limit: number; total: number; pages: number } }
> => {
  try {
    const skip = (page - 1) * limit;
    const [attributes, total] = await Promise.all([
      Attribute.find().sort({ _id: -1 }).skip(skip).limit(limit),
      Attribute.countDocuments(),
    ]);
    return {
      message: 'Attributes retrieved successfully',
      data: attributes,
      code: 200,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error('Error fetching attributes:', error);
    return { message: 'Failed to fetch attributes', data: null, code: 500, meta: { page, limit, total: 0, pages: 0 } };
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
 * Retrieves an attribute by its name (case-insensitive).
 */
const oneAttributeByName = async (name: string): Promise<CustomResponseType<AttributeType>> => {
  try {
    const attribute = await Attribute.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (!attribute) {
      return { message: 'Attribute not found', data: null, code: 404 };
    }
    return { message: 'Attribute retrieved successfully', data: attribute, code: 200 };
  } catch (error) {
    console.error('Error fetching attribute by name:', error);
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
}): Promise<CustomResponseType<null>> => {
  try {
    const attribute = await Attribute.updateOne({ _id: id }, data);
    if (attribute.modifiedCount === 0) {
      return { message: 'Attribute not found', data: null, code: 404 };
    }
    return { message: 'Attribute updated successfully', data: null, code: 200 };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { message: duplicateMessage(error, 'Attribute'), data: null, code: 400 };
    }
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
  oneAttributeByName,
  updateAttribute,
  deleteAttribute,
};
