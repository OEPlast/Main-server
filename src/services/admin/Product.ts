import { ObjectId } from 'mongodb';
import Product, { ProductType } from '../../models/Product';
import slugify from 'slugify';
import { CustomResponseType } from '@/types';

/**
 * Creates a new product or adds a sub-product to an existing product.
 * @param data - The data for the new product or sub-product.
 */
type CreateProductData = {
  name: string;
  description: string;
  brand: string;
  details: string;
  questions: string[];
  category: string;
  subCategories: string[];
  sku: string;
  color: { color: string; image: string };
  images: string[];
  description_images: string[];
  sizes: { size: string; qty: number; price: number }[];
  discount: number;
  slug?: string;
  parent?: string;
};

type SubProductFieldTypes = Pick<
  CreateProductData,
  'sku' | 'color' | 'images' | 'sizes' | 'discount' | 'description_images'
>;

const createProduct = async (data: CreateProductData): Promise<CustomResponseType<ProductType>> => {
  try {
    if (data.parent) {
      const parent = await Product.findById(data.parent);
      if (!parent) {
        return {
          message: 'Parent product not found',
          data: null,
          code: 400,
        };
      }
      await parent.updateOne(
        {
          $push: {
            subProducts: {
              sku: data.sku,
              color: data.color,
              images: data.images,
              description_images: data.description_images,
              sizes: data.sizes,
              discount: data.discount,
            },
          },
        },
        { new: true }
      );
      return {
        message: 'Sub-product added successfully',
        data: parent,
        code: 200,
      };
    } else {
      data.slug = slugify(data.name);
      const newProduct = new Product({
        name: data.name,
        description: data.description,
        brand: data.brand,
        details: data.details,
        questions: data.questions,
        slug: data.slug,
        category: data.category,
        subCategories: data.subCategories,
        subProducts: [
          {
            sku: data.sku,
            color: data.color,
            images: data.images,
            description_images: data.description_images,
            sizes: data.sizes,
            discount: data.discount,
          },
        ],
      });
      await newProduct.save();
      return {
        message: 'Product created successfully',
        data: newProduct,
        code: 201,
      };
    }
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
  data: Partial<Omit<CreateProductData, 'sku' | 'color' | 'images' | 'sizes' | 'discount' | 'description_images'>>
): Promise<CustomResponseType<ProductType>> => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(id, data, { new: true });
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
 * Searches for products based on query parameters.
 * @param query - The query parameters for searching products.
 */
type SearchQuery = {
  text?: string;
  slug?: string;
  id?: string;
};

const searchProducts = async (query: SearchQuery): Promise<CustomResponseType<ProductType[]>> => {
  try {
    const searchQuery: { [key: string]: unknown } = {};
    if (query.text) {
      searchQuery.$or = [
        { name: { $regex: query.text, $options: 'i' } },
        { description: { $regex: query.text, $options: 'i' } },
      ];
    }

    if (query.slug) {
      searchQuery.slug = query.slug;
    }

    if (query.id) {
      searchQuery._id = new ObjectId(query.id);
    }

    const products = await Product.find(searchQuery);
    return {
      message: 'Products retrieved successfully',
      data: products,
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
 * Retrieves all products with optional pagination.
 * @param page - The page number to retrieve.
 * @param limit - The number of products per page.
 */
const getAllProducts = async (
  page = 1,
  limit = 10
): Promise<CustomResponseType<{ products: ProductType[]; total: number; page: number; limit: number }>> => {
  try {
    const products = await Product.find()
      .skip((page - 1) * limit)
      .limit(limit);
    const totalProducts = await Product.countDocuments();
    return {
      message: 'Products retrieved successfully',
      data: { products, total: totalProducts, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Adds a sub-product of an existing product.
 * @param productId - The ID of the parent product.
 * @param data - The updated data for the sub-product.
 */
const addSubProduct = async (productId: string, data: SubProductFieldTypes): Promise<CustomResponseType<null>> => {
  try {
    const product = await Product.updateOne(
      { _id: productId },
      {
        $push: { subProducts: data },
      }
    );
    console.log(product);

    return {
      message: 'Sub-product updated successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error in updateSubProduct:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates a sub-product of an existing product.
 * @param productId - The ID of the parent product.
 * @param subProductId - The ID of the sub-product to update.
 * @param data - The updated data for the sub-product.
 */
const updateSubProduct = async (
  productId: string,
  subProductId: string,
  data: SubProductFieldTypes
): Promise<CustomResponseType<ProductType>> => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return {
        message: 'Parent product not found',
        data: null,
        code: 404,
      };
    }
    const subProductIndex = product.subProducts.findIndex((subProduct) => subProduct._id.toString() === subProductId);
    if (subProductIndex === -1) {
      return {
        message: 'Sub-product not found',
        data: null,
        code: 404,
      };
    }
    const subProduct = product.subProducts[subProductIndex];
    Object.assign(subProduct, data);
    await product.save();
    return {
      message: 'Sub-product updated successfully',
      data: product,
      code: 200,
    };
  } catch (error) {
    console.error('Error in updateSubProduct:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a sub-product from an existing product.
 * @param productId - The ID of the parent product.
 * @param subProductId - The ID of the sub-product to delete.
 */
const deleteSubProduct = async (productId: string, subProductId: string): Promise<CustomResponseType<ProductType>> => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return {
        message: 'Parent product not found',
        data: null,
        code: 404,
      };
    }
    const updateResult = await Product.updateOne(
      { _id: productId },
      {
        $pull: { subProducts: { _id: new ObjectId(subProductId) } },
      }
    );
    console.log(updateResult);

    return {
      message: 'Sub-product deleted successfully',
      data: product,
      code: 200,
    };
  } catch (error) {
    console.error('Error in deleteSubProduct:', error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

const ProductService = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  searchProducts,
  getAllProducts,
  updateSubProduct,
  deleteSubProduct,
  addSubProduct,
};

export default ProductService;
