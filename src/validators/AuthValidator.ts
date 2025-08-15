import { body } from 'express-validator';

// Shared helpers
const emailField = body('email').isEmail().withMessage('Valid email is required');
const passwordField = body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters');

export const loginValidator = [emailField, passwordField];

export const registerValidator = [
  emailField,
  passwordField,
  body('firstName').isString().withMessage('firstName must be a string'),
  body('lastName').isString().withMessage('lastName must be a string'),
];

export const changePasswordValidator = [
  body('user').isString().withMessage('user is required'),
  body('currentPassword').isString().isLength({ min: 6 }).withMessage('currentPassword must be at least 6 characters'),
  body('newPassword').isString().isLength({ min: 6 }).withMessage('newPassword must be at least 6 characters'),
];

export const requestResetPasswordCodeValidator = [emailField];

export const resetPasswordByCodeValidator = [
  emailField,
  body('code').isString().notEmpty().withMessage('code is required'),
  body('newPassword').isString().isLength({ min: 6 }).withMessage('newPassword must be at least 6 characters'),
];

export const verifyAccountOtpValidator = [
  body('user').isString().withMessage('user is required'),
  body('code').isString().notEmpty().withMessage('code is required'),
];

export const resendVerifyAccountOtpValidator = [body('user').isString().withMessage('user is required')];

// Aggregate for namespace-style usage
const AuthValidator = {
  loginValidator,
  registerValidator,
  changePasswordValidator,
  requestResetPasswordCodeValidator,
  resetPasswordByCodeValidator,
  verifyAccountOtpValidator,
  resendVerifyAccountOtpValidator,
};

export default AuthValidator;
