import type { NextFunction, Request, Response } from 'express';
import { checkSchema, validationResult, checkExact, oneOf } from 'express-validator';
import { PermissionAction, PermissionResource } from '@/types/permissions';

const createRoleValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      name: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        errorMessage: 'Role name is required and should be a string',
      },
      description: { in: ['body'], isString: true, optional: true, errorMessage: 'Description should be a string' },
      isActive: {
        in: ['body'],
        optional: true,
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'isActive must be a boolean',
      },
      permissions: {
        in: ['body'],
        optional: true,
        isArray: { options: { min: 1 }, errorMessage: 'Permissions must be an array' },
      },
      'permissions.*.resource': {
        in: ['body'],
        custom: {
          options: (value) => Object.values(PermissionResource).includes(value),
        },
        errorMessage: 'Invalid permission resource',
      },
      'permissions.*.actions': {
        in: ['body'],
        isArray: { options: { min: 1 }, errorMessage: 'Actions must be a non-empty array' },
      },
      'permissions.*.actions.*': {
        in: ['body'],
        custom: {
          options: (value) => Object.values(PermissionAction).includes(value),
        },
        errorMessage: 'Invalid permission action',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateRoleValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      roleId: { in: ['params'], isMongoId: true, errorMessage: 'Role ID must be a valid MongoDB ID' },
      name: { in: ['body'], isString: true, optional: true, errorMessage: 'Role name should be a string' },
      description: { in: ['body'], isString: true, optional: true, errorMessage: 'Description should be a string' },
      permissions: { in: ['body'], optional: true, isArray: { errorMessage: 'Permissions should be an array' } },
      isActive: {
        in: ['body'],
        optional: true,
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'isActive must be a boolean',
      },
      'permissions.*.resource': {
        in: ['body'],
        optional: true,
        custom: { options: (value) => Object.values(PermissionResource).includes(value) },
        errorMessage: 'Invalid permission resource',
      },
      'permissions.*.actions': {
        in: ['body'],
        optional: true,
        isArray: { errorMessage: 'Actions must be an array' },
      },
      'permissions.*.actions.*': {
        in: ['body'],
        optional: true,
        custom: { options: (value) => Object.values(PermissionAction).includes(value) },
        errorMessage: 'Invalid permission action',
      },
    })
  ).run(req);
  await oneOf(
    [
      checkSchema({
        name: { in: ['body'], notEmpty: true },
      }),
      checkSchema({
        description: { in: ['body'], notEmpty: true },
      }),
      checkSchema({
        isActive: { in: ['body'], notEmpty: true },
      }),
      checkSchema({
        permissions: {
          in: ['body'],
          isArray: { options: { min: 1 }, errorMessage: 'Permissions must be a non-empty array' },
        },
      }),
    ],
    { message: 'At least one of name, description or permissions must be provided' }
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const roleIdValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      roleId: {
        in: ['params'],
        isMongoId: true,
        errorMessage: 'Role ID must be a valid MongoDB ID',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const userIdValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      userId: {
        in: ['params'],
        isMongoId: true,
        errorMessage: 'User ID must be a valid MongoDB ID',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const assignRoleValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      userId: {
        in: ['body'],
        isMongoId: true,
        errorMessage: 'User ID must be a valid MongoDB ID',
      },
      roleId: {
        in: ['body'],
        isMongoId: true,
        errorMessage: 'Role ID must be a valid MongoDB ID',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const checkPermissionValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      userId: { in: ['params'], isMongoId: true, errorMessage: 'User ID must be a valid MongoDB ID' },
      resource: {
        in: ['body'],
        custom: { options: (value) => Object.values(PermissionResource).includes(value) },
        errorMessage: 'Invalid permission resource',
      },
      action: {
        in: ['body'],
        custom: { options: (value) => Object.values(PermissionAction).includes(value) },
        errorMessage: 'Invalid permission action',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const RoleValidator = {
  createRoleValidator,
  updateRoleValidator,
  roleIdValidator,
  userIdValidator,
  assignRoleValidator,
  checkPermissionValidator,
};

export default RoleValidator;
