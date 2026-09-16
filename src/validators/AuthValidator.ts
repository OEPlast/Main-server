import type { NextFunction, Request, Response } from 'express';
import { checkExact, checkSchema, validationResult } from 'express-validator';

// These validators used to build `checkSchema(...)` and never `.run(req)` it, so nothing was
// validated: a JSON object such as `{ "$gt": "" }` reached the Mongo query as an operator.
const loginValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    email: {
      in: ['body'],
      isEmail: true,
      errorMessage: 'Valid email is required',
    },
    // No length rule here: it belongs to choosing a password, not to typing an existing one.
    password: {
      in: ['body'],
      isString: true,
      notEmpty: true,
      errorMessage: 'Password is required',
    },
  }).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const providerLoginValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkExact(
    checkSchema({
      // Google is the only provider whose login can be verified (see verifyGoogleIdToken).
      provider: {
        in: ['body'],
        isIn: { options: [['google']] },
        errorMessage: 'provider must be google',
      },
      providerAccountId: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        errorMessage: 'providerAccountId is required',
      },
      idToken: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        errorMessage: 'idToken is required',
      },
    })
  ).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const registerValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
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
  }).run(req);
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

const verifyAccountOtpValidator = async (req: Request, res: Response, next: NextFunction) => {
  await checkSchema({
    code: {
      in: ['body'],
      isNumeric: true,
      notEmpty: true,
      errorMessage: 'code is required',
    },
  }).run(req);
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
