import { checkSchema, validationResult } from 'express-validator';
import type { NextFunction, Request, Response } from 'express';

const addImageValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    images: {
      in: ['body'],
      isArray: true,
      notEmpty: true,
      errorMessage: 'Images should be a non-empty array',
    },
    'images.*.title': {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Each image must have a title',
    },
    'images.*.imageUrl': {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Each image must have an imageUrl',
    },
    'images.*.description': {
      in: ['body'],
      optional: true,
      isString: true,
      errorMessage: 'Description must be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const deleteImageValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    images: {
      in: ['body'],
      isArray: true,
      notEmpty: true,
      errorMessage: 'Image IDs should be a non-empty array',
    },
    'images.*': {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Each image ID must be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateImageValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    image: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Image ID must be a non-empty string',
    },
    'updates.title': {
      in: ['body'],
      optional: true,
      isString: true,
      notEmpty: true,
      errorMessage: 'Title must be a non-empty string',
    },
    'updates.description': {
      in: ['body'],
      optional: true,
      isString: true,
      errorMessage: 'Description must be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const GalleryValidator = {
  addImageValidator,
  deleteImageValidator,
  updateImageValidator,
};

export default GalleryValidator;
