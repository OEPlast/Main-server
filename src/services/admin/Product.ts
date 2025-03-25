import Product, { ProductType } from '../../models/Product';
import slugify from 'slugify';
import { CustomResponseType } from '@/types';

/**
 * Creates a new product.
 * @param data - The data for the new product.
 */
type CreateProductData = {
  name: string;
  description: string;
  brand: string;
  price: number;
  category: string;
  subCategories?: string;
  description_images: { url: string; cover_image?: boolean }[];
  specifications: { key: string; value: string }[];
  shipping: number;
  deliveryTime: number;
  attributes?: {
    name: string;
    children: {
      name: string;
      price?: number;
      discount?: number;
      stock: number;
      image: string;
    }[];
  }[];
  tags: string[];
  stock: number;
  discount?: number;
};

const createProduct = async (data: CreateProductData): Promise<CustomResponseType<ProductType>> => {
  try {
    const newData: CreateProductData & { slug?: string } = data;
    newData.slug = slugify(data.name);
    const newProduct = await Product.insertOne(newData);
    return {
      message: 'Product created successfully',
      data: newProduct,
      code: 201,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates an existing product.
 * @param id - The ID of the product to update.
 * @param data - The updated data for the product.
 */
const updateProduct = async (
  id: string,
  data: Partial<CreateProductData>
): Promise<CustomResponseType<ProductType>> => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(id, data);
    if (!updatedProduct) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Product updated successfully',
      data: updatedProduct,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a product.
 * @param id - The ID of the product to delete.
 */
const deleteProduct = async (id: string): Promise<CustomResponseType<void>> => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Product deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Gets a product by its ID.
 * @param id - The ID of the product.
 */
const getProductById = async (id: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const product = await Product.findById(id);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Product retrieved successfully',
      data: product,
      code: 200,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Duplicates an existing product.
 * @param id - The ID of the product to duplicate.
 */
const duplicateProduct = async (id: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const product = await Product.findById(id);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    const duplicatedProductData = {
      ...product.toObject(),
      createdAt: undefined,
      updatedAt: undefined,
      status: 'inactive',
      _id: undefined,
      slug: `${product.slug}-copy`,
      name: `${product.name} (Copy)`,
    };

    const duplicatedProduct = await Product.create(duplicatedProductData);
    return {
      message: 'Product duplicated successfully',
      data: duplicatedProduct,
      code: 201,
    };
  } catch (error) {
    console.error('Error duplicating product:', error);
    return {
      message: 'Failed to duplicate product',
      data: null,
      code: 500,
    };
  }
};

// Add a function to update the cover image of a product
const updateCoverImage = async (productId: string, imageUrl: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return {
        message: 'Product not found',
        data: null,
        code: 404,
      };
    }

    // Update the cover image
    product.description_images.forEach((image) => {
      image.cover_image = image.url === imageUrl;
    });

    await product.save();

    return {
      message: 'Cover image updated successfully',
      data: product,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating cover image:', error);
    return {
      message: 'Failed to update cover image',
      data: null,
      code: 500,
    };
  }
};

const Admin_ProductService = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  duplicateProduct,
  updateCoverImage,
};

export default Admin_ProductService;
