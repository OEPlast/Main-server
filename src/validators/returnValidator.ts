import type { Request, Response, NextFunction } from 'express';
import { checkSchema, checkExact, validationResult } from 'express-validator';

// Return reason options
const RETURN_REASONS = [
  'defective',
  'wrong_item',
  'not_as_described',
  'size_issue',
  'quality_issue',
  'other',
] as const;

// Return status options
const RETURN_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'items_received',
  'inspecting',
  'inspection_passed',
  'inspection_failed',
  'completed',
  'cancelled',
] as const;

// Return types
const RETURN_TYPES = ['refund', 'exchange'] as const;

// Refund methods
const REFUND_METHODS = ['original_payment', 'store_credit', 'bank_transfer'] as const;

/**
 * Validator for initiating a return
 * POST /returns
 */
const initiateReturnValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      orderId: {
        in: ['body'],
        isMongoId: true,
        notEmpty: true,
        errorMessage: 'Valid order ID is required',
      },
      'items': {
        in: ['body'],
        isArray: { options: { min: 1 } },
        errorMessage: 'At least one item is required',
      },
      'items.*.product': {
        in: ['body'],
        isMongoId: true,
        notEmpty: true,
        errorMessage: 'Valid product ID is required for each item',
      },
      'items.*.qty': {
        in: ['body'],
        isInt: { options: { min: 1 } },
        errorMessage: 'Quantity must be at least 1',
      },
      'items.*.reason': {
        in: ['body'],
        isIn: { options: [RETURN_REASONS] },
        errorMessage: `Reason must be one of: ${RETURN_REASONS.join(', ')}`,
      },
      'items.*.reasonDetails': {
        in: ['body'],
        optional: true,
        isString: true,
        isLength: { options: { max: 500 } },
        errorMessage: 'Reason details must not exceed 500 characters',
      },
      'items.*.images': {
        in: ['body'],
        optional: true,
        isArray: true,
        errorMessage: 'Images must be an array of strings',
      },
      'items.*.images.*': {
        in: ['body'],
        optional: true,
        isString: true,
        errorMessage: 'Each image must be a string',
      },
      'items.*.attributes': {
        in: ['body'],
        optional: true,
        isArray: true,
        errorMessage: 'Attributes must be an array',
      },
      type: {
        in: ['body'],
        optional: true,
        isIn: { options: [RETURN_TYPES] },
        errorMessage: `Type must be one of: ${RETURN_TYPES.join(', ')}`,
      },
      customerNotes: {
        in: ['body'],
        optional: true,
        isString: true,
        isLength: { options: { max: 500 } },
        errorMessage: 'Customer notes must not exceed 500 characters',
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
      code: 400,
    });
  }

  next();
};

/**
 * Validator for updating return status
 * PATCH /admin/returns/:id/status
 */
const updateReturnStatusValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: {
        in: ['params'],
        isMongoId: true,
        notEmpty: true,
        errorMessage: 'Valid return ID is required',
      },
      status: {
        in: ['body'],
        isIn: { options: [RETURN_STATUSES] },
        notEmpty: true,
        errorMessage: `Status must be one of: ${RETURN_STATUSES.join(', ')}`,
      },
      adminNotes: {
        in: ['body'],
        optional: true,
        isString: true,
        isLength: { options: { max: 1000 } },
        errorMessage: 'Admin notes must not exceed 1000 characters',
      },
      refundAmount: {
        in: ['body'],
        optional: true,
        isFloat: { options: { min: 0 } },
        errorMessage: 'Refund amount must be a non-negative number',
      },
      restockingFee: {
        in: ['body'],
        optional: true,
        isFloat: { options: { min: 0 } },
        errorMessage: 'Restocking fee must be a non-negative number',
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
      code: 400,
    });
  }

  next();
};

/**
 * Validator for processing refund
 * POST /admin/returns/:id/refund
 */
const processRefundValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: {
        in: ['params'],
        isMongoId: true,
        notEmpty: true,
        errorMessage: 'Valid return ID is required',
      },
      refundAmount: {
        in: ['body'],
        isFloat: { options: { min: 0.01 } },
        notEmpty: true,
        errorMessage: 'Refund amount must be a positive number',
      },
      refundMethod: {
        in: ['body'],
        isIn: { options: [REFUND_METHODS] },
        notEmpty: true,
        errorMessage: `Refund method must be one of: ${REFUND_METHODS.join(', ')}`,
      },
      adminNotes: {
        in: ['body'],
        optional: true,
        isString: true,
        isLength: { options: { max: 1000 } },
        errorMessage: 'Admin notes must not exceed 1000 characters',
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
      code: 400,
    });
  }

  next();
};

/**
 * Validator for getting returns with filters
 * GET /admin/returns
 */
const getReturnsValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      status: {
        in: ['query'],
        optional: true,
        isIn: { options: [RETURN_STATUSES] },
        errorMessage: `Status must be one of: ${RETURN_STATUSES.join(', ')}`,
      },
      userId: {
        in: ['query'],
        optional: true,
        isMongoId: true,
        errorMessage: 'User ID must be a valid Mongo ID',
      },
      orderId: {
        in: ['query'],
        optional: true,
        isMongoId: true,
        errorMessage: 'Order ID must be a valid Mongo ID',
      },
      startDate: {
        in: ['query'],
        optional: true,
        isISO8601: true,
        errorMessage: 'Start date must be a valid ISO8601 date',
      },
      endDate: {
        in: ['query'],
        optional: true,
        isISO8601: true,
        errorMessage: 'End date must be a valid ISO8601 date',
      },
      search: {
        in: ['query'],
        optional: true,
        isString: true,
        errorMessage: 'Search must be a string',
      },
      page: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1 } },
        toInt: true,
        errorMessage: 'Page must be a positive integer',
      },
      limit: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1, max: 100 } },
        toInt: true,
        errorMessage: 'Limit must be between 1 and 100',
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
      code: 400,
    });
  }

  next();
};

/**
 * Validator for return ID parameter
 * GET /returns/:id
 */
const returnIdValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      id: {
        in: ['params'],
        isMongoId: true,
        notEmpty: true,
        errorMessage: 'Valid return ID is required',
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
      code: 400,
    });
  }

  next();
};

/**
 * Validator for customer getting their returns
 * GET /returns (customer route)
 */
const getMyReturnsValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      status: {
        in: ['query'],
        optional: true,
        isIn: { options: [RETURN_STATUSES] },
        errorMessage: `Status must be one of: ${RETURN_STATUSES.join(', ')}`,
      },
      page: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1 } },
        toInt: true,
        errorMessage: 'Page must be a positive integer',
      },
      limit: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1, max: 100 } },
        toInt: true,
        errorMessage: 'Limit must be between 1 and 100',
      },
    })
  ).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
      code: 400,
    });
  }

  next();
};

export default {
  initiateReturnValidator,
  updateReturnStatusValidator,
  processRefundValidator,
  getReturnsValidator,
  returnIdValidator,
  getMyReturnsValidator,
};
