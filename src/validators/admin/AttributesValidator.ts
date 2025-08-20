import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, validationResult } from 'express-validator';

const create_And_Update_AttributeValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      name: {
        in: ['body'],
        isString: true,
        optional: true,
        errorMessage: 'Attribute name should be a string',
      },
      children: {
        in: ['body'],
        isArray: true,
        optional: true,
        errorMessage: 'Children should be an array',
      },
      'children.*.name': {
        in: ['body'],
        isString: true,
        notEmpty: true,
        errorMessage: 'Each child must have a name',
      },
      'children.*.image': {
        in: ['body'],
        optional: true,
        isString: true,
        notEmpty: true,
        errorMessage: 'Each image must have an imageUrl',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const getAttributeByIdValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isMongoId: {
        errorMessage: 'Invalid attribute id',
      },
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const getAttributeByNameValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    name: {
      in: ['params'],
      isString: true,
      notEmpty: {
        errorMessage: 'Attribute name is required',
      },
      errorMessage: 'Attribute name must be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const listAttributesValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    page: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 }, errorMessage: 'page must be a positive integer' },
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1, max: 100 }, errorMessage: 'limit must be between 1 and 100' },
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const AttributesValidator = {
  create_And_Update_AttributeValidator,
  getAttributeByIdValidator,
  getAttributeByNameValidator,
  listAttributesValidator,
};

export default AttributesValidator;
