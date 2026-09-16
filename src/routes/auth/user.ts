import AuthController from '@/controller/authController';
import express from 'express';
import AuthValidator from '@/validators/AuthValidator';
import { authenticateUser } from '@/middleware/auth';
import RateLimits from '@/middleware/rate';
const router = express.Router();

router.post('/login', RateLimits.Login_Limiter, AuthValidator.loginValidator, AuthController.userLogin);
router.post('/login/provider', AuthValidator.providerLoginValidator, AuthController.providerLogin);
router.post('/register', RateLimits.Register_Limiter, AuthValidator.registerValidator, AuthController.userRegister);
router.post(
  '/changePassword',
  authenticateUser,
  AuthValidator.changePasswordValidator,
  AuthController.updateUserPassword
);
router.post(
  '/setPassword',
  authenticateUser,
  AuthValidator.setPasswordValidator,
  AuthController.setPassword
);
router.get(
  '/passwordAndProviderStatus',
  authenticateUser,
  AuthController.userPasswordAndProviderStatus
);
router.post(
  '/requestResetPasswordCode',
  RateLimits.OTP_Limiter,
  AuthValidator.requestResetPasswordCodeValidator,
  AuthController.requestResetPasswordCode
);
router.post(
  '/resetPasswordByCode',
  RateLimits.CodeCheck_Limiter,
  AuthValidator.resetPasswordByCodeValidator,
  AuthController.resetUserPasswordByCode
);

router.post(
  '/verifyAccount',
  AuthValidator.verifyAccountOtpValidator,
  authenticateUser,
  // After authenticateUser, so the limit is keyed on the signed-in account.
  RateLimits.CodeCheck_Limiter,
  AuthController.verifyAccountOtp
);

router.post('/resendVerifyAccountOtp', RateLimits.OTP_Limiter, authenticateUser, AuthController.resendVerifyAccountOtp);

export default router;
