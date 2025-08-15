import AuthController from '@/controller/authController';
import express from 'express';
import AuthValidator from '@/validators/AuthValidator';
import { validate } from '@/middleware/validate';
const router = express.Router();

router.post('/logout', () => {});
router.post('/login', AuthValidator.loginValidator, validate, AuthController.userLogin);
router.post('/register', AuthValidator.registerValidator, validate, AuthController.userRegister);
router.post('/changePassword', AuthValidator.changePasswordValidator, validate, AuthController.updateUserPassword);
router.post(
  '/requestResetPasswordCode',
  AuthValidator.requestResetPasswordCodeValidator,
  validate,
  AuthController.requestResetPasswordCode
);
router.post(
  '/resetPasswordByCode',
  AuthValidator.resetPasswordByCodeValidator,
  validate,
  AuthController.resetUserPasswordByCode
);
router.post('/verifyAccountOtp', AuthValidator.verifyAccountOtpValidator, validate, AuthController.verifyAccountOtp);
router.post(
  '/resendVerifyAccountOtp',
  AuthValidator.resendVerifyAccountOtpValidator,
  validate,
  AuthController.resendVerifyAccountOtp
);

export default router;
