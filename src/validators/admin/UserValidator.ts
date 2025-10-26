import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, validationResult } from 'express-validator';

const getAllUsersValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      page: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1 } },
        errorMessage: 'Page must be a positive integer',
      },
      role: {
        in: ['query'],
        optional: true,
        isIn: { options: [['owner', 'user', 'manager', 'employee']] },
        errorMessage: 'role must be a either of owner,user,manager or employee',
      },
      limit: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1 } },
        errorMessage: 'Limit must be a positive integer',
      },
      search: {
        in: ['query'],
        optional: true,
        isString: true,
        errorMessage: 'Search must be a string',
      },
      sort: {
        in: ['query'],
        optional: true,
        isIn: { options: [['1', '-1']], errorMessage: "Sort must be '1' (asc) or '-1' (desc)" },
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const getUserByIdValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'User ID is required and should be a string',
    },
    orderPage: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      errorMessage: 'Order page must be a positive integer',
    },
    orderLimit: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      errorMessage: 'Order limit must be a positive integer',
    },
    reviewPage: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      errorMessage: 'Review page must be a positive integer',
    },
    reviewLimit: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      errorMessage: 'Review limit must be a positive integer',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateUserRoleValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      role: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        isIn: {
          options: [['owner', 'user', 'manager', 'employee']],
          errorMessage: 'role must be a either of owner,user,manager or employee',
        },
        errorMessage: 'Role is required and should be a string',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateUserSuspensionValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    suspend: {
      in: ['body'],
      isBoolean: true,
      notEmpty: true,
      errorMessage: 'Suspend status is required and should be a boolean',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const deleteUserValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    id: {
      in: ['params'],
      isString: true,
      notEmpty: true,
      errorMessage: 'User ID is required and should be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const usersByRole = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    role: {
      in: ['query'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Role is required and should be a string',
    },
    page: {
      in: ['query'],
      optional: true,
      isInt: { options: { min: 1 } },
      errorMessage: 'Page must be a positive integer',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const getStaffValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      page: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1 } },
        errorMessage: 'Page must be a positive integer',
      },
      limit: {
        in: ['query'],
        optional: true,
        isInt: { options: { min: 1, max: 100 } },
        errorMessage: 'Limit must be between 1 and 100',
      },
      search: {
        in: ['query'],
        optional: true,
        isString: true,
        errorMessage: 'Search must be a string',
      },
      role: {
        in: ['query'],
        optional: true,
        isIn: { options: [['employee', 'owner']] },
        errorMessage: 'Role must be either employee or owner',
      },
      sort: {
        in: ['query'],
        optional: true,
        isIn: { options: [['1', '-1']], errorMessage: "Sort must be '1' (asc) or '-1' (desc)" },
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const searchUsersValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      q: {
        in: ['query'],
        isString: true,
        notEmpty: true,
        isLength: {
          options: { min: 2, max: 100 },
        },
        errorMessage: 'Search query must be between 2 and 100 characters',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const Admin_UserValidator = {
  getAllUsersValidator,
  getUserByIdValidator,
  updateUserRoleValidator,
  updateUserSuspensionValidator,
  deleteUserValidator,
  usersByRole,
  getStaffValidator,
  searchUsersValidator,
};

export default Admin_UserValidator;
