import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult } from 'express-validator';

const createRoleValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    name: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Role name is required and should be a string',
    },
    description: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Description should be a string',
    },
    permissions: {
      in: ['body'],
      isArray: true,
      optional: true,
      errorMessage: 'Permissions should be an array',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateRoleValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    roleId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Role ID must be a valid MongoDB ID',
    },
    name: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Role name should be a string',
    },
    description: {
      in: ['body'],
      isString: true,
      optional: true,
      errorMessage: 'Description should be a string',
    },
    permissions: {
      in: ['body'],
      isArray: true,
      optional: true,
      errorMessage: 'Permissions should be an array',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const roleIdValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    roleId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Role ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const userIdValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    userId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'User ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const addPermissionValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    roleId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Role ID must be a valid MongoDB ID',
    },
    permission: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Permission is required and should be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const removePermissionValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    roleId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Role ID must be a valid MongoDB ID',
    },
    permission: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Permission is required and should be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const assignRoleValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    userId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'User ID must be a valid MongoDB ID',
    },
    roleId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'Role ID must be a valid MongoDB ID',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const checkPermissionValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    userId: {
      in: ['params'],
      isMongoId: true,
      errorMessage: 'User ID must be a valid MongoDB ID',
    },
    permission: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Permission is required and should be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const RoleValidator = {
  createRoleValidator,
  updateRoleValidator,
  roleIdValidator,
  userIdValidator,
  addPermissionValidator,
  removePermissionValidator,
  assignRoleValidator,
  checkPermissionValidator,
};

export default RoleValidator;
