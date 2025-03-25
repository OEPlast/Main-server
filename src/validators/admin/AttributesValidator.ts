import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const create_And_Update_AttributeValidator = (req: Request, res: Response, next: NextFunction) => {
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
      isString: true,
      notEmpty: true,
      errorMessage: 'Each image must have an imageUrl',
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
};

export default AttributesValidator;
