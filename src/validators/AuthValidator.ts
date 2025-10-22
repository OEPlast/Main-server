import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, validationResult } from 'express-validator';

const loginValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    email: {
      in: ['body'],
      isEmail: true,
      errorMessage: 'Valid email is required',
    },
    password: {
      in: ['body'],
      isString: true,
      isLength: { options: { min: 6 } },
      errorMessage: 'Password must be at least 6 characters',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const providerLoginValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      provider: {
        in: ['body'],
        isString: true,
        errorMessage: 'provider type is required (google, reddit, github...)',
      },
      providerAccountId: {
        in: ['body'],
        isString: true,
        errorMessage: 'providerAccountId is required',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const registerValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    email: {
      in: ['body'],
      isEmail: true,
      errorMessage: 'Valid email is required',
    },
    password: {
      in: ['body'],
      isString: true,
      isLength: { options: { min: 6 } },
      errorMessage: 'Password must be at least 6 characters',
    },
    firstName: {
      in: ['body'],
      isString: true,
      errorMessage: 'firstName must be a string',
    },
    lastName: {
      in: ['body'],
      isString: true,
      errorMessage: 'lastName must be a string',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const changePasswordValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      currentPassword: {
        in: ['body'],
        isString: true,
        isLength: { options: { min: 6 }, errorMessage: 'currentPassword must be at least 6 characters' },
      },
      newPassword: {
        in: ['body'],
        isString: true,
        isLength: { options: { min: 6 } },
        errorMessage: 'newPassword must be at least 6 characters',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const requestResetPasswordCodeValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      email: {
        in: ['body'],
        isEmail: true,
        notEmpty: true,
        errorMessage: 'Valid email is required',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const resetPasswordByCodeValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      code: {
        in: ['body'],
        isNumeric: true,
        exists: true,
        notEmpty: true,
        errorMessage: 'code is required',
      },
      email: {
        in: ['body'],
        isEmail: true,
        exists: true,
        errorMessage: 'Valid email is required',
      },
      newPassword: {
        in: ['body'],
        isString: true,
        exists: true,
        isLength: { options: { min: 6 } },
        errorMessage: 'newPassword must be at least 6 characters',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const verifyAccountOtpValidator = (req: Request, res: Response, next: NextFunction) => {
  checkSchema({
    code: {
      in: ['body'],
      notEmpty: true,
      errorMessage: 'code is required',
    },
  });
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const setPasswordValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      newPassword: {
        in: ['body'],
        isString: true,
        isLength: { options: { min: 8 } },
        errorMessage: 'newPassword must be at least 8 characters',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const AuthValidator = {
  loginValidator,
  providerLoginValidator,
  registerValidator,
  changePasswordValidator,
  requestResetPasswordCodeValidator,
  resetPasswordByCodeValidator,
  verifyAccountOtpValidator,
  setPasswordValidator,
};

export default AuthValidator;
