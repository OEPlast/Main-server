import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

//order validator for admin

const updateOrderDetails = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    shippingProgress: {
      optional: true,
      isArray: {
        errorMessage: 'Shipping progress must be an array',
      },
      custom: {
        options: (value) => {
          if (!value.every((item: { location: string; date: string }) => item.location && item.date)) {
            throw new Error('Each shipping progress item must have a location and date');
          }
          return true;
        },
      },
    },
    deliveryStatus: {
      optional: true,
      isString: {
        errorMessage: 'Delivery status must be a string',
      },
      isIn: {
        options: [['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Returned']],
        errorMessage: 'Invalid delivery status',
      },
    },
    status: {
      optional: true,
      isString: {
        errorMessage: 'Status must be a string',
      },
      isIn: {
        options: [['Not Processed', 'Processing', 'Dispatched', 'Cancelled', 'Completed']],
        errorMessage: 'Invalid status',
      },
    },
    shippingAddress: {
      optional: true,
      isObject: {
        errorMessage: 'Shipping address must be an object',
      },
      custom: {
        options: (value) => {
          const requiredFields = [
            'firstName',
            'lastName',
            'phoneNumber',
            'address1',
            'city',
            'state',
            'zipCode',
            'country',
          ];
          for (const field of requiredFields) {
            if (!value[field]) {
              throw new Error(`Shipping address must include ${field}`);
            }
          }
          return true;
        },
      },
    },
    products: {
      optional: true,
      isArray: {
        errorMessage: 'Products must be an array',
      },
      custom: {
        options: (value) => {
          if (
            !value.every(
              (item: { product: string; qty: number; price: number }) => item.product && item.qty > 0 && item.price >= 0
            )
          ) {
            throw new Error(
              'Each product must have a valid product ID, quantity greater than 0, and price greater than or equal to 0'
            );
          }
          return true;
        },
      },
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateRejectOrder = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    orderId: {
      in: ['params'],
      isString: {
        errorMessage: 'Order ID must be a string',
      },
      notEmpty: {
        errorMessage: 'Order ID is required',
      },
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateDeliveryTimeline = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    orderId: {
      in: ['params'],
      isString: {
        errorMessage: 'Order ID must be a string',
      },
      notEmpty: {
        errorMessage: 'Order ID is required',
      },
    },
    timeline: {
      in: ['body'],
      isString: {
        errorMessage: 'Timeline must be a string',
      },
      notEmpty: {
        errorMessage: 'Timeline is required',
      },
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
        errorMessage: 'Page must be a positive integer',
      },
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1 },
        errorMessage: 'Limit must be a positive integer',
      },
    },
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateTopOrderedProducts = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    startDate: {
      in: ['query'],
      isISO8601: {
        errorMessage: 'Start date must be a valid ISO 8601 date',
      },
      notEmpty: {
        errorMessage: 'Start date is required',
      },
    },
    endDate: {
      in: ['query'],
      isISO8601: {
        errorMessage: 'End date must be a valid ISO 8601 date',
      },
      notEmpty: {
        errorMessage: 'End date is required',
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
  updateOrderDetails,
  validateRejectOrder,
  updateDeliveryTimeline,
  validatePagination,
  validateTopOrderedProducts,
};

export default OrderValidator;
