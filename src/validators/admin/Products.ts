import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

// products api validator

// Validator for creating a product
const createProductValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    name: {
      isString: true,
      notEmpty: true,
      errorMessage: 'Name is required and should be a string',
    },
    description: {
      isString: true,
      notEmpty: true,
      errorMessage: 'Description is required and should be a string',
    },
    brand: {
      isString: true,
      notEmpty: true,
      errorMessage: 'Brand is required and should be a string',
    },
    details: {
      isString: true,
      notEmpty: true,
      errorMessage: 'Details are required and should be a string',
    },
    questions: {
      isArray: true,
      errorMessage: 'Questions should be an array of strings',
    },
    category: {
      isString: true,
      notEmpty: true,
      errorMessage: 'Category is required and should be a string',
    },
    subCategories: {
      isArray: true,
      errorMessage: 'SubCategories should be an array of strings',
    },
    sku: {
      isString: true,
      notEmpty: true,
      errorMessage: 'SKU is required and should be a string',
    },
    color: {
      isObject: true,
      errorMessage: 'Color should be an object with color and image properties',
    },
    images: {
      isArray: true,
      errorMessage: 'Images should be an array of strings',
    },
    description_images: {
      isArray: true,
      errorMessage: 'Description images should be an array of strings',
    },
    sizes: {
      isArray: true,
      errorMessage: 'Sizes should be an array of objects with size, qty, and price properties',
    },
    discount: {
      isNumeric: true,
      errorMessage: 'Discount should be a number',
    },
    slug: {
      optional: true,
      isString: true,
      errorMessage: 'Slug should be a string',
    },
    parent: {
      optional: true,
      isString: true,
      errorMessage: 'Parent should be a string',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for updating a product
const updateProductValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
    },
    name: {
      optional: true,
      isString: true,
      errorMessage: 'Name should be a string',
    },
    description: {
      optional: true,
      isString: true,
      errorMessage: 'Description should be a string',
    },
    brand: {
      optional: true,
      isString: true,
      errorMessage: 'Brand should be a string',
    },
    details: {
      optional: true,
      isString: true,
      errorMessage: 'Details should be a string',
    },
    questions: {
      optional: true,
      isArray: true,
      errorMessage: 'Questions should be an array of strings',
    },
    category: {
      optional: true,
      isString: true,
      errorMessage: 'Category should be a string',
    },
    subCategories: {
      optional: true,
      isArray: true,
      errorMessage: 'SubCategories should be an array of strings',
    },
    slug: {
      optional: true,
      isString: true,
      errorMessage: 'Slug should be a string',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for deleting a product
const deleteProductValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for getting a product by ID
const getProductByIdValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      isString: true,
      notEmpty: true,
      errorMessage: 'ID is required and should be a string',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for searching products
const searchProductsValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    text: {
      optional: true,
      isString: true,
      errorMessage: 'Text should be a string',
    },
    slug: {
      optional: true,
      isString: true,
      errorMessage: 'Slug should be a string',
    },
    id: {
      optional: true,
      isString: true,
      errorMessage: 'ID should be a string',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for getting all products with pagination
const getAllProductsValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    page: {
      optional: true,
      isNumeric: true,
      errorMessage: 'Page should be a number',
    },
    limit: {
      optional: true,
      isNumeric: true,
      errorMessage: 'Limit should be a number',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for updating a Adding-product
const addSubProductValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Product ID is required and should be a string',
    },
    sku: {
      notEmpty: true,
      isString: true,
      errorMessage: 'SKU is required and should be a string',
    },
    color: {
      notEmpty: true,
      isObject: true,
      errorMessage: 'Color is required and should be an object with color and image properties',
    },
    images: {
      notEmpty: true,
      isArray: true,
      errorMessage: 'Images is required and should be an array of strings',
    },
    description_images: {
      notEmpty: true,
      isArray: true,
      errorMessage: 'Description is required and images should be an array of strings',
    },
    sizes: {
      notEmpty: true,
      isArray: true,
      errorMessage: 'Sizes is required and should be an array of objects with size, qty, and price properties',
    },
    discount: {
      notEmpty: true,
      isNumeric: true,
      errorMessage: 'Discount is required and should be a number',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
// Validator for updating a sub-product
const updateSubProductValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Product ID is required and should be a string',
    },
    subId: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Sub-product ID is required and should be a string',
    },
    sku: {
      optional: true,
      isString: true,
      errorMessage: 'SKU should be a string',
    },
    color: {
      optional: true,
      isObject: true,
      errorMessage: 'Color should be an object with color and image properties',
    },
    images: {
      optional: true,
      isArray: true,
      errorMessage: 'Images should be an array of strings',
    },
    description_images: {
      optional: true,
      isArray: true,
      errorMessage: 'Description images should be an array of strings',
    },
    sizes: {
      optional: true,
      isArray: true,
      errorMessage: 'Sizes should be an array of objects with size, qty, and price properties',
    },
    discount: {
      optional: true,
      isNumeric: true,
      errorMessage: 'Discount should be a number',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for deleting a sub-product
const deleteSubProductValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Product ID is required and should be a string',
    },
    subId: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Sub-product ID is required and should be a string',
    },
  });

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const ProductValidator = {
  createProductValidator,
  updateProductValidator,
  deleteProductValidator,
  getProductByIdValidator,
  searchProductsValidator,
  getAllProductsValidator,
  updateSubProductValidator,
  deleteSubProductValidator,
  addSubProductValidator,
};

export default ProductValidator;
