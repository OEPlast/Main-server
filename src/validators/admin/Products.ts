import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult, checkExact } from 'express-validator';

// products api validator

// Validator for creating a product (aligned with Product model)
const createProductValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      sku: { isNumeric: true, notEmpty: true, errorMessage: 'sku is required and must be a number' },
      name: { isString: true, notEmpty: true, errorMessage: 'name is required' },
      description: { isString: true, notEmpty: true, errorMessage: 'description is required' },
      price: { isNumeric: true, errorMessage: 'price must be a number' },
      category: { isMongoId: true, notEmpty: true, errorMessage: 'category is required' },

      tags: { optional: true, isArray: true },
      'tags.*': { optional: true, isString: true },

      description_images: { optional: true, isArray: true },
      'description_images.*.url': { optional: true, isString: true, notEmpty: true },
      'description_images.*.cover_image': { optional: true, isBoolean: true },

      specifications: { optional: true, isArray: true },
      'specifications.*.key': { optional: true, isString: true, notEmpty: true },
      'specifications.*.value': { optional: true, isString: true, notEmpty: true },

      dimension: { optional: true, isArray: true },
      'dimension.*.key': {
        optional: true,
        isIn: { options: [['length', 'breadth', 'height', 'volume', 'width', 'weight']] },
        errorMessage: 'dimension.key must be one of length|breadth|height|volume|width|weight',
      },
      'dimension.*.value': { optional: true, isString: true, notEmpty: true },

      shipping: { optional: true, isObject: true },
      'shipping.addedCost': {
        optional: true,
        isFloat: { options: { min: 0 } },
        errorMessage: 'shipping.addedCost must be a non-negative number',
      },
      'shipping.increaseCostBy': {
        optional: true,
        isFloat: { options: { min: 0 } },
        errorMessage: 'shipping.increaseCostBy must be a non-negative number',
      },
      'shipping.addedDays': {
        optional: true,
        isInt: { options: { min: 0 } },
        errorMessage: 'shipping.addedDays must be a non-negative integer',
      },

      attributes: { optional: true, isArray: true },
      'attributes.*.name': { optional: true, isString: true, notEmpty: true },
      'attributes.*.children': { optional: true, isArray: true },
      'attributes.*.children.*.name': { optional: true, isString: true, notEmpty: true },
      'attributes.*.children.*.price': { optional: true, isNumeric: true },
      'attributes.*.children.*.stock': { optional: true, isNumeric: true },
      'attributes.*.children.*.image': { optional: true, isString: true, notEmpty: true },

      'attributes.*.children.*.pricingTiers': { optional: true, isArray: true },
      'attributes.*.children.*.pricingTiers.*.minQty': { optional: true, isInt: { options: { min: 1 } } },
      'attributes.*.children.*.pricingTiers.*.maxQty': { optional: true, isInt: { options: { min: 1 } } },
      'attributes.*.children.*.pricingTiers.*.strategy': {
        optional: true,
        isIn: { options: [['fixedPrice', 'percentOff', 'amountOff']] },
      },
      'attributes.*.children.*.pricingTiers.*.value': { optional: true, isNumeric: true },

      pricingTiers: { optional: true, isArray: true },
      'pricingTiers.*.minQty': { optional: true, isInt: { options: { min: 1 } } },
      'pricingTiers.*.maxQty': { optional: true, isInt: { options: { min: 1 } } },
      'pricingTiers.*.strategy': { optional: true, isIn: { options: [['fixedPrice', 'percentOff', 'amountOff']] } },
      'pricingTiers.*.value': { optional: true, isNumeric: true },

      stock: { isNumeric: true, errorMessage: 'stock must be a number' },
      lowStockThreshold: { optional: true, isNumeric: true },
      status: { optional: true, isIn: { options: [['active', 'inactive', 'archived']] } },
    })
  ).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for updating a product (partial, aligned with Product model)
const updateProductValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: { in: ['params'], isMongoId: true, notEmpty: true, optional: false, errorMessage: 'id is required' },

      sku: { optional: true, isNumeric: true },
      name: { optional: true, isString: true },
      description: { optional: true, isString: true },
      price: { optional: true, isNumeric: true },
      category: { optional: true, isString: true },

      tags: { optional: true, isArray: true },
      'tags.*': { optional: true, isString: true },

      description_images: { optional: true, isArray: true },
      'description_images.*.url': { optional: true, isString: true, notEmpty: true },
      'description_images.*.cover_image': { optional: true, isBoolean: true },

      specifications: { optional: true, isArray: true },
      'specifications.*.key': { optional: true, isString: true },
      'specifications.*.value': { optional: true, isString: true },

      dimension: { optional: true, isArray: true },
      'dimension.*.key': {
        optional: true,
        isIn: { options: [['length', 'breadth', 'height', 'volume', 'width', 'weight']] },
      },
      'dimension.*.value': { optional: true, isString: true },

      shipping: { optional: true, isObject: true },
      'shipping.addedCost': { optional: true, isFloat: { options: { min: 0 } } },
      'shipping.increaseCostBy': { optional: true, isFloat: { options: { min: 0 } } },
      'shipping.addedDays': { optional: true, isInt: { options: { min: 0 } } },

      attributes: { optional: true, isArray: true },
      'attributes.*.name': { optional: true, isString: true },
      'attributes.*.children': { optional: true, isArray: true },
      'attributes.*.children.*.name': { optional: true, isString: true },
      'attributes.*.children.*.price': { optional: true, isNumeric: true },
      'attributes.*.children.*.stock': { optional: true, isNumeric: true },
      'attributes.*.children.*.image': { optional: true, isString: true },

      'attributes.*.children.*.pricingTiers': { optional: true, isArray: true },
      'attributes.*.children.*.pricingTiers.*.minQty': { optional: true, isInt: { options: { min: 1 } } },
      'attributes.*.children.*.pricingTiers.*.maxQty': { optional: true, isInt: { options: { min: 1 } } },
      'attributes.*.children.*.pricingTiers.*.strategy': {
        optional: true,
        isIn: { options: [['fixedPrice', 'percentOff', 'amountOff']] },
      },
      'attributes.*.children.*.pricingTiers.*.value': { optional: true, isNumeric: true },

      pricingTiers: { optional: true, isArray: true },
      'pricingTiers.*.minQty': { optional: true, isInt: { options: { min: 1 } } },
      'pricingTiers.*.maxQty': { optional: true, isInt: { options: { min: 1 } } },
      'pricingTiers.*.strategy': { optional: true, isIn: { options: [['fixedPrice', 'percentOff', 'amountOff']] } },
      'pricingTiers.*.value': { optional: true, isNumeric: true },

      stock: { optional: true, isNumeric: true },
      lowStockThreshold: { optional: true, isNumeric: true },
      status: { optional: true, isIn: { options: [['active', 'inactive', 'archived']] } },
      slug: { optional: true, isString: true },
    })
  ).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for deleting a product
const deleteProductValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: {
        isString: true,
        notEmpty: true,
        errorMessage: 'ID is required and should be a string',
      },
    })
  ).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for getting a product by ID
const getProductByIdValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: {
        in: ['params'],
        isMongoId: true,
        optional: false,
        errorMessage: 'ID is required and should be a string',
      },
    })
  ).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for searching products
const searchProductsValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
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
    })
  ).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for getting all products with pagination
const getAllProductsValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
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
    })
  ).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for updating a Adding-product
const addSubProductValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
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
    })
  ).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
// Validator for updating a sub-product
const updateSubProductValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
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
    })
  ).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validator for deleting a sub-product
const updateCoverImageValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: {
        in: ['params'],
        isString: true,
        notEmpty: true,
        errorMessage: 'Product ID is required and should be a string',
      },
      imageId: {
        in: ['body'],
        isMongoId: true,
        optional: false,
        errorMessage: 'imageId is required and should be an id',
      },
    })
  ).run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Extra validators for array-edit endpoints
const addTagsValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      productId: { in: ['params'], isString: true, notEmpty: true },
      tags: { in: ['body'], isArray: true, errorMessage: 'tags must be an array of strings' },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const removeTagValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      productId: { in: ['params'], isString: true, notEmpty: true },
      tag: { in: ['params'], isString: true, notEmpty: true },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const addSpecificationsValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      productId: { in: ['params'], isString: true, notEmpty: true },
      specifications: { in: ['body'], isArray: true },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const removeSpecificationValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      productId: { in: ['params'], isString: true, notEmpty: true },
      key: { in: ['body'], isString: true, notEmpty: true },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
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
  updateCoverImageValidator,
  addSubProductValidator,
  addTagsValidator,
  removeTagValidator,
  addSpecificationsValidator,
  removeSpecificationValidator,
};

export default ProductValidator;
