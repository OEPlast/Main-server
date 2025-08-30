import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

//order validator for user

const validateSecureCheckout = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    // Items array validation
    'items': {
      in: ['body'],
      isArray: {
        options: { min: 1 },
        errorMessage: 'Items array must contain at least one item.',
      },
    },
    'items.*.product': {
      in: ['body'],
      isMongoId: true,
      errorMessage: 'Each item must have a valid product MongoDB ID.',
    },
    'items.*.qty': {
      in: ['body'],
      isInt: {
        options: { min: 1 },
        errorMessage: 'Each item quantity must be at least 1.',
      },
    },
    'items.*.unitPrice': {
      in: ['body'],
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Each item must have a valid unit price.',
      },
    },
    'items.*.totalPrice': {
      in: ['body'],
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Each item must have a valid total price.',
      },
    },
    
    // Cart totals validation
    'subtotal': {
      in: ['body'],
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Subtotal must be a positive number.',
      },
    },
    'total': {
      in: ['body'],
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Total must be a positive number.',
      },
    },
    'totalDiscount': {
      in: ['body'],
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Total discount must be a positive number.',
      },
    },
    
    // Coupon codes validation (optional array of strings)
    'couponCodes': {
      in: ['body'],
      optional: true,
      isArray: {
        options: { max: 5 }, // Limit to max 5 coupons
        errorMessage: 'Coupon codes must be an array with maximum 5 items.',
      },
    },
    'couponCodes.*': {
      in: ['body'],
      optional: true,
      isString: true,
      isLength: {
        options: { min: 3, max: 20 },
        errorMessage: 'Each coupon code must be between 3 and 20 characters.',
      },
      matches: {
        options: /^[A-Z0-9_-]+$/,
        errorMessage: 'Coupon codes can only contain uppercase letters, numbers, hyphens, and underscores.',
      },
    },
    
    // Shipping address validation
    'shippingAddress': {
      in: ['body'],
      notEmpty: true,
      errorMessage: 'Shipping address is required.',
    },
    'shippingAddress.firstName': {
      in: ['body'],
      isLength: {
        options: { min: 1, max: 50 },
        errorMessage: 'First name must be between 1 and 50 characters.',
      },
    },
    'shippingAddress.lastName': {
      in: ['body'],
      isLength: {
        options: { min: 1, max: 50 },
        errorMessage: 'Last name must be between 1 and 50 characters.',
      },
    },
    'shippingAddress.address1': {
      in: ['body'],
      isLength: {
        options: { min: 5, max: 200 },
        errorMessage: 'Address must be between 5 and 200 characters.',
      },
    },
    'shippingAddress.city': {
      in: ['body'],
      isLength: {
        options: { min: 2, max: 50 },
        errorMessage: 'City must be between 2 and 50 characters.',
      },
    },
    'shippingAddress.state': {
      in: ['body'],
      isLength: {
        options: { min: 2, max: 50 },
        errorMessage: 'State must be between 2 and 50 characters.',
      },
    },
    'shippingAddress.country': {
      in: ['body'],
      isLength: {
        options: { min: 2, max: 50 },
        errorMessage: 'Country must be between 2 and 50 characters.',
      },
    },
    
    // Delivery type validation
    'deliveryType': {
      in: ['body'],
      optional: true,
      isIn: {
        options: [['shipping', 'pickup']],
        errorMessage: 'Delivery type must be either "shipping" or "pickup".',
      },
    },
    
    // Shipping cost validation (required if delivery type is shipping)
    'shippingCost': {
      in: ['body'],
      optional: true,
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Shipping cost must be a positive number.',
      },
    },
    
    // Payment method validation
    'paymentMethod': {
      in: ['body'],
      optional: true,
      isIn: {
        options: [['paystack', 'flutterwave', 'card', 'bank_transfer', 'cash_on_delivery']],
        errorMessage: 'Payment method must be one of: paystack, flutterwave, card, bank_transfer, cash_on_delivery.',
      },
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array() 
    });
  }
  next();
};

const validateShippingCalculation = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    // Items array validation
    'items': {
      in: ['body'],
      isArray: {
        options: { min: 1 },
        errorMessage: 'Items array must contain at least one item.',
      },
    },
    'items.*.product': {
      in: ['body'],
      isMongoId: true,
      errorMessage: 'Each item must have a valid product MongoDB ID.',
    },
    'items.*.qty': {
      in: ['body'],
      isInt: {
        options: { min: 1 },
        errorMessage: 'Each item quantity must be at least 1.',
      },
    },
    'items.*.totalPrice': {
      in: ['body'],
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Each item must have a valid total price.',
      },
    },
    
    // Delivery type validation
    'deliveryType': {
      in: ['body'],
      optional: true,
      isIn: {
        options: [['shipping', 'pickup']],
        errorMessage: 'Delivery type must be either "shipping" or "pickup".',
      },
    },
    
    // Conditional shipping address validation - only required if delivery type is shipping
    'shippingAddress': {
      in: ['body'],
      optional: true,
      custom: {
        options: (value, { req }) => {
          const deliveryType = req.body.deliveryType || 'shipping';
          if (deliveryType === 'shipping' && !value) {
            throw new Error('Shipping address is required when delivery type is shipping');
          }
          return true;
        },
      },
    },
    'shippingAddress.country': {
      in: ['body'],
      optional: true,
      isLength: {
        options: { min: 2, max: 50 },
        errorMessage: 'Country must be between 2 and 50 characters.',
      },
    },
    'shippingAddress.state': {
      in: ['body'],
      optional: true,
      isLength: {
        options: { min: 2, max: 50 },
        errorMessage: 'State must be between 2 and 50 characters.',
      },
    },
    'shippingAddress.city': {
      in: ['body'],
      optional: true,
      isLength: {
        options: { min: 2, max: 50 },
        errorMessage: 'City must be between 2 and 50 characters.',
      },
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array() 
    });
  }
  next();
};

const validateOrderId = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Order ID must be a valid MongoDB ID.',
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    page: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1 },
        errorMessage: 'Page must be a positive integer.',
      },
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1 },
        errorMessage: 'Limit must be a positive integer.',
      },
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateOrderQueryParams = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    page: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1 },
        errorMessage: 'Page must be a positive integer.',
      },
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1 },
        errorMessage: 'Limit must be a positive integer.',
      },
    },
    status: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']],
        errorMessage: 'Status must be one of: pending, confirmed, processing, shipped, delivered, cancelled, returned',
      },
    },
    deliveryStatus: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['pending', 'processing', 'shipped', 'delivered', 'failed']],
        errorMessage: 'Delivery status must be one of: pending, processing, shipped, delivered, failed',
      },
    },
    transactionStatus: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['all', 'pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded']],
        errorMessage: 'Transaction status must be one of: all, pending, completed, failed, cancelled, refunded, partially_refunded',
      },
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const OrderValidator = {
  validateSecureCheckout,
  validateShippingCalculation,
  validateOrderId,
  validatePagination,
  validateOrderQueryParams,
};

export default OrderValidator;
