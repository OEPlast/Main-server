import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, validationResult } from 'express-validator';

const MODEL_STATUSES = ['In-Warehouse', 'Shipped', 'Dispatched', 'Delivered', 'Returned', 'Failed'] as const;

export const listMineValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      page: { in: ['query'], optional: true, isInt: { options: { min: 1 } }, errorMessage: 'page must be >=1' },
      limit: { in: ['query'], optional: true, isInt: { options: { min: 1, max: 100 } }, errorMessage: 'limit 1-100' },
      status: {
        in: ['query'],
        optional: true,
        isIn: { options: [Array.from(MODEL_STATUSES)], errorMessage: 'invalid status' },
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

export const shipmentIdValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    shipmentId: { in: ['params'], isMongoId: true, errorMessage: 'Invalid shipmentId' },
  }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

export const updateStatusValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      shipmentId: { in: ['params'], isMongoId: true, errorMessage: 'Invalid shipmentId' },
      status: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        isIn: { options: [Array.from(MODEL_STATUSES)], errorMessage: 'invalid status' },
      },
      note: { in: ['body'], optional: true, isString: true },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

export const addTrackingValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      shipmentId: { in: ['params'], isMongoId: true, errorMessage: 'Invalid shipmentId' },
      status: { in: ['body'], isString: true, isIn: { options: [Array.from(MODEL_STATUSES)] }, notEmpty: true },
      location: { in: ['body'], optional: true, isString: true },
      description: { in: ['body'], optional: true, isString: true },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

export const updateNotesValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      shipmentId: { in: ['params'], isMongoId: true, errorMessage: 'Invalid shipmentId' },
      notes: { in: ['body'], isString: true, notEmpty: true },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const DeliveryValidator = {
  listMineValidator,
  shipmentIdValidator,
  updateStatusValidator,
  addTrackingValidator,
  updateNotesValidator,
};

export default DeliveryValidator;
