import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, Schema, validationResult } from 'express-validator';

//order validator for user

/**
 * Per-field rules for an address, shared by `shippingAddress` and `billingAddress`.
 *
 * Every field is `optional` so the rules only apply to an address that was actually sent —
 * whether an address is *required* depends on the delivery type, which the service decides.
 * The return type is annotated because `isLength.options` otherwise widens and stops matching
 * express-validator's `Schema`.
 */
const addressFieldRules = (prefix: 'shippingAddress' | 'billingAddress'): Schema => ({
  [`${prefix}.firstName`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { min: 1, max: 50 }, errorMessage: 'First name must be between 1 and 50 characters.' },
  },
  [`${prefix}.lastName`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { min: 1, max: 50 }, errorMessage: 'Last name must be between 1 and 50 characters.' },
  },
  [`${prefix}.address1`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { min: 5, max: 200 }, errorMessage: 'Address must be between 5 and 200 characters.' },
  },
  [`${prefix}.address2`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { max: 200 }, errorMessage: 'Address line 2 cannot exceed 200 characters.' },
  },
  [`${prefix}.city`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { min: 2, max: 50 }, errorMessage: 'City must be between 2 and 50 characters.' },
  },
  [`${prefix}.state`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { min: 2, max: 50 }, errorMessage: 'State must be between 2 and 50 characters.' },
  },
  [`${prefix}.lga`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { max: 100 }, errorMessage: 'LGA cannot exceed 100 characters.' },
  },
  [`${prefix}.zipCode`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { max: 20 }, errorMessage: 'Postal code cannot exceed 20 characters.' },
  },
  [`${prefix}.country`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { min: 2, max: 50 }, errorMessage: 'Country must be between 2 and 50 characters.' },
  },
  [`${prefix}.phoneNumber`]: {
    in: ['body'],
    optional: true,
    isLength: { options: { max: 30 }, errorMessage: 'Phone number cannot exceed 30 characters.' },
  },
  [`${prefix}.latitude`]: { in: ['body'], optional: true, isFloat: { errorMessage: 'Latitude must be a number.' } },
  [`${prefix}.longitude`]: { in: ['body'], optional: true, isFloat: { errorMessage: 'Longitude must be a number.' } },
});

const validateSecureCheckout = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    // Items array validation
    items: {
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
    subtotal: {
      in: ['body'],
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Subtotal must be a positive number.',
      },
    },
    total: {
      in: ['body'],
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Total must be a positive number.',
      },
    },
    totalDiscount: {
      in: ['body'],
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Total discount must be a positive number.',
      },
    },

    // Coupon codes validation (optional array of strings)
    couponCodes: {
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

    // Guest contact. Required only when the request carries no token — the route runs
    // authenticateUserIfTokenSent, so `userId` is set for signed-in shoppers and their `guest`
    // block (if any) is ignored. Presence is checked here as a whole; formats per field below.
    guest: {
      in: ['body'],
      custom: {
        options: (value: unknown, { req }) => {
          if ((req as Request & { userId?: string }).userId) return true;

          const guest = value as Record<string, unknown> | undefined;
          const missing = ['email', 'firstName', 'lastName', 'phoneNumber'].filter(
            (field) => typeof guest?.[field] !== 'string' || !(guest[field] as string).trim()
          );
          if (missing.length > 0) {
            throw new Error('Please enter your email, name and phone number to check out as a guest.');
          }
          return true;
        },
      },
    },
    'guest.email': {
      in: ['body'],
      optional: true,
      trim: true,
      toLowerCase: true,
      isEmail: { errorMessage: 'Please enter a valid email address.' },
      isLength: { options: { max: 254 }, errorMessage: 'Email address is too long.' },
    },
    'guest.firstName': {
      in: ['body'],
      optional: true,
      trim: true,
      isLength: { options: { min: 1, max: 50 }, errorMessage: 'First name must be 1-50 characters.' },
    },
    'guest.lastName': {
      in: ['body'],
      optional: true,
      trim: true,
      isLength: { options: { min: 1, max: 50 }, errorMessage: 'Last name must be 1-50 characters.' },
    },
    'guest.phoneNumber': {
      in: ['body'],
      optional: true,
      trim: true,
      matches: {
        options: /^\+?[0-9\s()-]{7,20}$/,
        errorMessage: 'Please enter a valid phone number.',
      },
    },

    // Shipping address validation.
    //
    // Optional at the object level because a pickup order legitimately has none — the service
    // is what enforces "required for shipping/gig" (CheckoutService), since only it knows the
    // resolved delivery type. The per-field rules below therefore only fire once an address
    // is actually present.
    shippingAddress: {
      in: ['body'],
      optional: true,
      isObject: {
        errorMessage: 'Shipping address must be an object.',
      },
    },
    ...addressFieldRules('shippingAddress'),

    // Billing address. Absent means "same as the shipping address"; the flag below is what
    // records that intent explicitly on the order.
    billingSameAsShipping: {
      in: ['body'],
      optional: true,
      isBoolean: {
        errorMessage: 'billingSameAsShipping must be a boolean.',
      },
      toBoolean: true,
    },
    billingAddress: {
      in: ['body'],
      optional: true,
      isObject: {
        errorMessage: 'Billing address must be an object.',
      },
    },
    ...addressFieldRules('billingAddress'),

    // Delivery type validation
    deliveryType: {
      in: ['body'],
      optional: true,
      isIn: {
        options: [['shipping', 'pickup', 'gig']],
        errorMessage: 'Delivery type must be one of: shipping, pickup, gig.',
      },
    },

    // Shipping cost validation (required if delivery type is shipping)
    shippingCost: {
      in: ['body'],
      optional: true,
      isFloat: {
        options: { min: 0 },
        errorMessage: 'Shipping cost must be a positive number.',
      },
    },

    // Payment method validation
    paymentMethod: {
      in: ['body'],
      optional: true,
      isIn: {
        options: [['paystack', 'flutterwave', 'card', 'bank_transfer', 'cash_on_delivery']],
        errorMessage: 'Payment method must be one of: paystack, flutterwave, card, bank_transfer, cash_on_delivery.',
      },
    },
    notes: {
      in: ['body'],
      optional: true,
      isLength: {
        options: { max: 1000 },
        errorMessage: 'Order notes cannot exceed 1000 characters.',
      },
    },

    // Consumed by CheckoutService but previously undeclared. They were never rejected because
    // this whole chain was built and then discarded without being run; declaring them keeps
    // the live payload valid now that it is enforced.
    taxPrice: {
      in: ['body'],
      optional: true,
      isFloat: { options: { min: 0 }, errorMessage: 'Tax must be a positive number.' },
    },
    acceptChanges: {
      in: ['body'],
      optional: true,
      isBoolean: { errorMessage: 'acceptChanges must be a boolean.' },
      toBoolean: true,
    },
    estimatedShipping: {
      in: ['body'],
      optional: true,
      isObject: { errorMessage: 'estimatedShipping must be an object.' },
    },
    'estimatedShipping.cost': {
      in: ['body'],
      optional: true,
      isFloat: { options: { min: 0 }, errorMessage: 'Estimated shipping cost must be a positive number.' },
    },
    'estimatedShipping.days': {
      in: ['body'],
      optional: true,
      isInt: { options: { min: 0 }, errorMessage: 'Estimated shipping days must be a positive integer.' },
    },
    'items.*.selectedAttributes': {
      in: ['body'],
      optional: true,
      isArray: { errorMessage: 'selectedAttributes must be an array.' },
    },
  }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

const validateShippingCalculation = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    // Items array validation
    items: {
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
    deliveryType: {
      in: ['body'],
      optional: true,
      isIn: {
        options: [['shipping', 'pickup']],
        errorMessage: 'Delivery type must be either "shipping" or "pickup".',
      },
    },

    // Conditional shipping address validation - only required if delivery type is shipping
    shippingAddress: {
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
      errors: errors.array(),
    });
  }
  next();
};

const validateOrderId = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: {
        in: ['params'],
        isMongoId: true,
        errorMessage: 'Order ID must be a valid MongoDB ID.',
      },
    })
  ).run(req);

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
        errorMessage:
          'Transaction status must be one of: all, pending, completed, failed, cancelled, refunded, partially_refunded',
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
